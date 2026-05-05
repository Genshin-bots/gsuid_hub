import { useState, useEffect, useCallback, useRef } from 'react';
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
  Tag,
  TrendingUp,
  Zap,
  AlertCircle,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { memeApi, MemeRecord, MemeStatsData, MemeListParams } from '@/lib/api';
import { toast } from '@/hooks/use-toast';

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

function MemeCard({
  meme,
  onClick,
  isGlass,
}: {
  meme: MemeRecord;
  onClick: () => void;
  isGlass: boolean;
}) {
  const { t } = useLanguage();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
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
        if (!revoked) setBlobUrl(url);
      } catch {
        if (!revoked) setImgError(true);
      }
    };
    fetchImage();
    return () => {
      revoked = true;
      controller.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meme.meme_id]);

  const statusColorMap: Record<string, string> = {
    pending: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    tagged: 'bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20',
    manual: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20',
    pending_manual: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/20',
    rejected: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20',
  };

  return (
    <Card
      className={cn(
        "group cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] overflow-hidden",
        isGlass && "glass-card"
      )}
      onClick={onClick}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted/30 overflow-hidden">
        {!imgLoaded && !imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="w-full h-full absolute" />
            <ImageIcon className="w-8 h-8 text-muted-foreground/30 relative z-10" />
          </div>
        )}
        {imgError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/30" />
            <span className="text-xs text-muted-foreground/50">加载失败</span>
          </div>
        ) : (
          <img
            src={blobUrl || undefined}
            alt={meme.description || meme.meme_id}
            className={cn(
              "w-full h-full object-cover transition-all duration-500",
              imgLoaded ? "opacity-100" : "opacity-0",
              "group-hover:scale-105"
            )}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
        {/* Status badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0.5 backdrop-blur-sm",
              statusColorMap[meme.status] || 'bg-muted/80'
            )}
          >
            {t(`aiMeme.status.${meme.status}`)}
          </Badge>
        </div>
        {/* Use count overlay */}
        {meme.use_count > 0 && (
          <div className="absolute top-2 right-2">
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0.5 backdrop-blur-sm bg-black/50 text-white border-0"
            >
              <Zap className="w-3 h-3 mr-0.5" />
              {meme.use_count}
            </Badge>
          </div>
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="w-10 h-10 rounded-full bg-white/90 dark:bg-black/70 flex items-center justify-center backdrop-blur-sm">
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
        {meme.emotion_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
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
        )}
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
}

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
      toast({ title: t('common.success'), description: t('aiMeme.detail.updateSuccess') });
      onUpdate();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('aiMeme.detail.updateFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetag = async () => {
    try {
      setIsRetagging(true);
      await memeApi.retag(meme.meme_id);
      toast({ title: t('common.success'), description: t('aiMeme.detail.retagSuccess') });
      setShowRetagDialog(false);
      onUpdate();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('aiMeme.detail.retagFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsRetagging(false);
    }
  };

  const handleMove = async () => {
    if (!moveTarget.trim()) return;
    try {
      setIsMoving(true);
      await memeApi.move(meme.meme_id, moveTarget.trim());
      toast({
        title: t('common.success'),
        description: t('aiMeme.detail.moveSuccess', { folder: moveTarget }),
      });
      setShowMoveDialog(false);
      onUpdate();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('aiMeme.detail.moveFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsMoving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await memeApi.delete(meme.meme_id);
      toast({ title: t('common.success'), description: t('aiMeme.detail.deleteSuccess') });
      setShowDeleteDialog(false);
      onDelete();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('aiMeme.detail.deleteFailed'),
        variant: 'destructive',
      });
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
// Upload Dialog
// ============================================================================

function UploadDialog({
  open,
  onClose,
  onSuccess,
  isGlass,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isGlass: boolean;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [folder, setFolder] = useState('common');
  const [autoTag, setAutoTag] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (selectedFile: File) => {
    if (!selectedFile.type.startsWith('image/')) {
      toast({
        title: t('common.error'),
        description: '请选择图片文件',
        variant: 'destructive',
      });
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setIsUploading(true);
      await memeApi.upload(file, folder, autoTag);
      toast({ title: t('common.success'), description: t('aiMeme.upload.uploadSuccess') });
      handleClose();
      onSuccess();
    } catch (error) {
      toast({
        title: t('common.error'),
        description: t('aiMeme.upload.uploadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setPreview(null);
    setFolder('common');
    setAutoTag(true);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
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
              "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer",
              isDragOver
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border/50 hover:border-primary/50 hover:bg-muted/30",
              preview && "p-4"
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            {preview ? (
              <div className="relative">
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-[200px] mx-auto rounded-lg object-contain"
                />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    setPreview(null);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  {file?.name} ({formatFileSize(file?.size || 0)})
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

          {/* Folder */}
          <div className="space-y-2">
            <Label className="text-sm">{t('aiMeme.upload.folder')}</Label>
            <Input
              value={folder}
              onChange={(e) => setFolder(e.target.value)}
              placeholder="common"
              className="h-9"
            />
          </div>

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
            <Switch
              checked={autoTag}
              onCheckedChange={setAutoTag}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleUpload} disabled={!file || isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                {t('aiMeme.upload.uploading')}
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-1.5" />
                {t('aiMeme.upload.selectFile')}
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

  // Filters
  const [filterFolder, setFilterFolder] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('created_at_desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Dialogs
  const [selectedMeme, setSelectedMeme] = useState<MemeRecord | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

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

      const data = await memeApi.getList(params);
      setMemes(data.records);
      setTotal(data.total);
    } catch (error) {
      console.error('Failed to fetch memes:', error);
      toast({
        title: t('common.error'),
        description: t('aiMeme.loadFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, sortBy, filterFolder, filterStatus, searchQuery, t]);

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

  useEffect(() => {
    fetchMemes();
  }, [fetchMemes]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

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
  }, [filterFolder, filterStatus, sortBy]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleMemeClick = async (meme: MemeRecord) => {
    try {
      const detail = await memeApi.getDetail(meme.meme_id);
      setSelectedMeme(detail);
    } catch {
      setSelectedMeme(meme);
    }
    setDetailOpen(true);
  };

  const handleDetailUpdate = () => {
    fetchMemes();
    fetchStats();
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
  };

  const handleUploadSuccess = () => {
    fetchMemes();
    fetchStats();
  };

  const totalPages = Math.ceil(total / pageSize);

  // Get unique folders from stats
  const folders = stats ? Object.keys(stats.folder_counts).sort() : [];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            {t('aiMeme.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('aiMeme.description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { fetchMemes(); fetchStats(); }}
            className="gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            {t('aiMeme.refresh')}
          </Button>
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" />
            {t('aiMeme.upload.title')}
          </Button>
        </div>
      </div>

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

      {/* Filter Bar */}
      <Card className={cn(isGlass && "glass-card")}>
        <CardContent className="p-4 space-y-3">
          {/* Search Row */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={t('aiMeme.filter.searchPlaceholder')}
              className="h-9 pl-10 pr-9 text-sm"
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

          {/* Filter Row */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Folder Filter */}
            <Select
              value={filterFolder || '__all__'}
              onValueChange={(v) => setFilterFolder(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <div className="flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder={t('aiMeme.filter.allFolders')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('aiMeme.filter.allFolders')}</SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                    {stats?.folder_counts[f] !== undefined && (
                      <span className="ml-1.5 text-muted-foreground">({stats.folder_counts[f]})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select
              value={filterStatus || '__all__'}
              onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                  <SelectValue placeholder={t('aiMeme.filter.allStatus')} />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{t('aiMeme.filter.allStatus')}</SelectItem>
                <SelectItem value="pending">{t('aiMeme.status.pending')}</SelectItem>
                <SelectItem value="tagged">{t('aiMeme.status.tagged')}</SelectItem>
                <SelectItem value="manual">{t('aiMeme.status.manual')}</SelectItem>
                <SelectItem value="pending_manual">{t('aiMeme.status.pendingManual')}</SelectItem>
                <SelectItem value="rejected">{t('aiMeme.status.rejected')}</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select
              value={sortBy}
              onValueChange={(v) => setSortBy(v as SortOption)}
            >
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
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
        </CardContent>
      </Card>

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
                onClick={() => handleMemeClick(meme)}
                isGlass={isGlass}
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
      />
    </div>
  );
}
