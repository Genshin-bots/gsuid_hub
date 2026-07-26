import { useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Send,
  Image as ImageIcon,
  Mic,
  Video,
  Paperclip,
  X,
  Hand,
  AtSign,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// Types
// ============================================================================

export interface PendingMedia {
  id: string;
  file: File;
  kind: 'image' | 'record' | 'video' | 'file';
  previewUrl?: string;
}

interface MessageComposerProps {
  value: string;
  onChange: (v: string) => void;
  pending: PendingMedia[];
  onAddFiles: (files: FileList | File[], kind?: PendingMedia['kind']) => void;
  onRemovePending: (id: string) => void;
  onSend: () => void;
  onPoke?: () => void;
  onAtBot?: () => void;
  disabled?: boolean;
  sending?: boolean;
  replyPreview?: string | null;
  onClearReply?: () => void;
  isGroup?: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Component
// ============================================================================

export function MessageComposer({
  value,
  onChange,
  pending,
  onAddFiles,
  onRemovePending,
  onSend,
  onPoke,
  onAtBot,
  disabled,
  sending,
  replyPreview,
  onClearReply,
  isGroup,
  t,
}: MessageComposerProps) {
  const [dragging, setDragging] = useState(false);
  const imageRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSend = !disabled && !sending && (value.trim().length > 0 || pending.length > 0);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.length) {
      e.preventDefault();
      onAddFiles(files);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files?.length) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  return (
    <div
      className={cn(
        'border-t border-border/50 p-3 sm:p-4 shrink-0 space-y-2',
        dragging && 'bg-primary/5',
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {replyPreview && (
        <div className="flex items-center gap-2 text-xs bg-muted/60 rounded-lg px-2.5 py-1.5">
          <span className="text-muted-foreground shrink-0">{t('liveChat.replyingTo')}</span>
          <span className="truncate flex-1">{replyPreview}</span>
          <button type="button" onClick={onClearReply} className="p-0.5 hover:text-foreground text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pending.map((p) => (
            <div
              key={p.id}
              className="relative group rounded-lg border border-border/50 bg-muted/30 overflow-hidden"
            >
              {p.kind === 'image' && p.previewUrl ? (
                <img src={p.previewUrl} alt="" className="w-16 h-16 object-cover" />
              ) : (
                <div className="w-16 h-16 flex flex-col items-center justify-center text-[10px] text-muted-foreground p-1">
                  {p.kind === 'record' && <Mic className="w-4 h-4 mb-0.5" />}
                  {p.kind === 'video' && <Video className="w-4 h-4 mb-0.5" />}
                  {p.kind === 'file' && <Paperclip className="w-4 h-4 mb-0.5" />}
                  <span className="truncate max-w-full px-1">{p.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => onRemovePending(p.id)}
                className="absolute top-0.5 right-0.5 rounded-full bg-background/90 p-0.5 shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) onAddFiles(e.target.files, 'image');
                e.target.value = '';
              }}
            />
            <input
              ref={audioRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) onAddFiles(e.target.files, 'record');
                e.target.value = '';
              }}
            />
            <input
              ref={videoRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) onAddFiles(e.target.files, 'video');
                e.target.value = '';
              }}
            />
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) onAddFiles(e.target.files, 'file');
                e.target.value = '';
              }}
            />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => imageRef.current?.click()}
                >
                  <ImageIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('liveChat.attachImage')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => audioRef.current?.click()}
                >
                  <Mic className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('liveChat.attachAudio')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => videoRef.current?.click()}
                >
                  <Video className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('liveChat.attachVideo')}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={disabled}
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t('liveChat.attachFile')}</TooltipContent>
            </Tooltip>

            {isGroup && onAtBot && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={onAtBot}
                  >
                    <AtSign className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('liveChat.atBot')}</TooltipContent>
              </Tooltip>
            )}

            {onPoke && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    onClick={onPoke}
                  >
                    <Hand className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('liveChat.poke')}</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t('liveChat.inputPlaceholder')}
          disabled={disabled || sending}
          rows={1}
          className={cn(
            'min-h-9 max-h-32 resize-none text-sm py-2',
            'focus-visible:ring-1',
          )}
        />

        <Button
          type="button"
          size="icon"
          className="h-9 w-9 shrink-0"
          disabled={!canSend}
          onClick={onSend}
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
