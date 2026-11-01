/**
 * 输入框：普通 / MD消息 / Card / 富媒体 四个页签。
 *
 * 引用与 @ 由消息列表右键塞进来（`replyTo` / `mention`），这里只负责显示与发出去。
 * Card 只开放图文卡片（tuwen）——其它类型协议端大多不支持，先不摆出来；
 * 富媒体只给一个「选择文件」，图片 / 语音 / 视频 / 文件按 MIME 自动分段。
 */
import { useEffect, useRef, useState } from 'react';
import type { ClipboardEvent } from 'react';
import { AtSign, FileUp, ImagePlus, Loader2, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { messageToText, type ChatMsg, type SendPayload } from '@/lib/sessionChat';

type Mode = 'plain' | 'markdown' | 'card' | 'rich';

export interface MentionItem {
  userId: string;
  name: string;
}

interface ComposerProps {
  disabled?: boolean;
  sending?: boolean;
  replyTo?: ChatMsg | null;
  onClearReply: () => void;
  mention?: MentionItem | null;
  onClearMention: () => void;
  onSend: (payload: SendPayload) => Promise<boolean> | boolean | void;
}

const MODE_VALUES: Mode[] = ['plain', 'markdown', 'card', 'rich'];

const MODE_LABEL_KEY: Record<Mode, string> = {
  plain: 'sessionManagement.modePlain',
  markdown: 'sessionManagement.modeMarkdown',
  card: 'sessionManagement.modeCard',
  rich: 'sessionManagement.modeRich',
};

const MODE_TIP_KEY: Record<Mode, string> = {
  plain: 'sessionManagement.modePlainTip',
  markdown: 'sessionManagement.modeMarkdownTip',
  card: 'sessionManagement.modeCardTip',
  rich: 'sessionManagement.modeRichTip',
};

const MAX_FILES = 9;

const ATTACHMENT_KIND_KEY = {
  image: 'sessionManagement.nodeImage',
  record: 'sessionManagement.nodeAudio',
  video: 'sessionManagement.nodeVideo',
  file: 'sessionManagement.nodeFile',
} as const;

/** 图文卡片的字段名用 QQ 官方接口的叫法（description / pic_url / url），留空的不发 */
interface CardField {
  key: string;
  placeholderKey: string;
}

const CARD_FIELDS: CardField[] = [
  { key: 'title', placeholderKey: 'sessionManagement.cardTitle' },
  { key: 'description', placeholderKey: 'sessionManagement.cardDescription' },
  { key: 'pic_url', placeholderKey: 'sessionManagement.cardPicUrl' },
  { key: 'url', placeholderKey: 'sessionManagement.cardUrl' },
];

/** 富媒体按 MIME / 扩展名归段，扩展名兜底是因为浏览器给的 type 常为空 */
function classifyFile(file: File): 'image' | 'record' | 'video' | 'file' {
  const type = file.type || '';
  const ext = (file.name.split('.').pop() ?? '').toLowerCase();
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'].includes(ext)) return 'image';
  if (type.startsWith('video/') || ['mp4', 'mov', 'mkv', 'avi', 'webm'].includes(ext)) return 'video';
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'silk', 'amr'].includes(ext)) {
    return 'record';
  }
  return 'file';
}

export function Composer({
  disabled,
  sending,
  replyTo,
  onClearReply,
  mention,
  onClearMention,
  onSend,
}: ComposerProps) {
  const { t } = useLanguage();
  const [mode, setMode] = useState<Mode>('plain');
  const [text, setText] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [records, setRecords] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [ats, setAts] = useState<MentionItem[]>([]);

  /* ---- Card 表单 ---- */
  const [cardValues, setCardValues] = useState<Record<string, string>>({});

  const imageInput = useRef<HTMLInputElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);

  // 右键 @ 塞进来的人，去重后追加
  useEffect(() => {
    if (!mention) return;
    setAts((prev) => (prev.some((item) => item.userId === mention.userId) ? prev : [...prev, mention]));
    onClearMention();
  }, [mention, onClearMention]);

  const addImages = (picked: File[]) => {
    if (!picked.length) return;
    setImages((prev) => [...prev, ...picked].slice(0, MAX_FILES));
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const picked = Array.from(event.clipboardData?.files ?? []).filter((file) => file.type.startsWith('image/'));
    if (picked.length) {
      event.preventDefault();
      addImages(picked);
    }
  };

  /** 富媒体：一个入口收所有类型，按 MIME 自动分到四个桶里 */
  const addMedia = (picked: File[]) => {
    if (!picked.length) return;
    const next = { image: [] as File[], record: [] as File[], video: [] as File[], file: [] as File[] };
    for (const item of picked) next[classifyFile(item)].push(item);
    if (next.image.length) setImages((prev) => [...prev, ...next.image]);
    if (next.record.length) setRecords((prev) => [...prev, ...next.record]);
    if (next.video.length) setVideos((prev) => [...prev, ...next.video]);
    if (next.file.length) setFiles((prev) => [...prev, ...next.file]);
  };

  const totalAttachments = images.length + records.length + videos.length + files.length;

  /** Card 参数：空字段不发，协议端对空 value 会报参数错误 */
  const buildCardPayload = (): string => {
    const content: Record<string, string> = {};
    for (const field of CARD_FIELDS) {
      const value = (cardValues[field.key] ?? '').trim();
      if (value) content[field.key] = value;
    }
    return JSON.stringify({ type: 'tuwen', content });
  };

  const cardFilled = CARD_FIELDS.some((field) => (cardValues[field.key] ?? '').trim().length > 0);

  const buildPayload = (): SendPayload | null => {
    const base: SendPayload = {
      mode,
      at: ats.map((item) => item.userId).join(','),
      reply: replyTo?.msg_id ?? '',
    };
    if (mode === 'card') {
      if (!cardFilled) {
        toast.error(t('sessionManagement.cardFieldRequired'));
        return null;
      }
      return { ...base, card: buildCardPayload() };
    }
    if (mode === 'markdown') {
      if (!markdown.trim() && totalAttachments === 0) {
        toast.error(t('sessionManagement.contentRequired'));
        return null;
      }
      // 附件要全带上：切页签时上一个页签选的附件还留着，只发 images 会把它们静默丢掉，
      // 而 canSend 又把它们算进了「有内容」
      return { ...base, markdown, images, records, videos, files };
    }
    if (mode === 'rich' && totalAttachments === 0) {
      toast.error(t('sessionManagement.fileRequired'));
      return null;
    }
    if (!text.trim() && totalAttachments === 0) {
      toast.error(t('sessionManagement.contentRequired'));
      return null;
    }
    return { ...base, text, images, records, videos, files };
  };

  const submit = async () => {
    if (sending || disabled) return;
    const payload = buildPayload();
    if (!payload) return;
    const ok = await onSend(payload);
    if (ok === false) return;
    setText('');
    setMarkdown('');
    setImages([]);
    setRecords([]);
    setVideos([]);
    setFiles([]);
    setAts([]);
    onClearReply();
  };

  const canSend =
    !sending &&
    !disabled &&
    (mode === 'card'
      ? cardFilled
      : mode === 'rich'
        ? totalAttachments > 0
        : mode === 'markdown'
          ? markdown.trim().length > 0 || totalAttachments > 0
          : text.trim().length > 0 || totalAttachments > 0);

  const attachments = [
    ...images.map((file, idx) => ({ kind: 'image' as const, file, idx })),
    ...records.map((file, idx) => ({ kind: 'record' as const, file, idx })),
    ...videos.map((file, idx) => ({ kind: 'video' as const, file, idx })),
    ...files.map((file, idx) => ({ kind: 'file' as const, file, idx })),
  ];

  /** 富媒体和普通两处附件条都要「删掉第 idx 个」，逻辑一样，收在这里 */
  const removeAttachment = (kind: 'image' | 'record' | 'video' | 'file', idx: number) => {
    const drop = <T,>(list: T[]) => list.filter((_, i) => i !== idx);
    if (kind === 'image') setImages(drop);
    if (kind === 'record') setRecords(drop);
    if (kind === 'video') setVideos(drop);
    if (kind === 'file') setFiles(drop);
  };

  const modeOptions = MODE_VALUES.map((value) => ({ value, label: t(MODE_LABEL_KEY[value]) }));

  /** 附件条：富媒体和普通两处只差「显不显示类型」，其余一样 */
  const renderAttachments = (showKind: boolean, maxWidth: string) => (
    <div className="flex flex-wrap gap-1">
      {attachments.map((item) => (
        <span
          key={`${item.kind}-${item.idx}-${item.file.name}`}
          className={`inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] ${maxWidth}`}
        >
          {showKind && (
            <span className="shrink-0 text-muted-foreground">{t(ATTACHMENT_KIND_KEY[item.kind])}</span>
          )}
          <span className="truncate">{item.file.name}</span>
          <button
            type="button"
            title={t('sessionManagement.removeImage')}
            onClick={() => removeAttachment(item.kind, item.idx)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );

  return (
    <div className="border-t border-border/60 px-3 pb-3 pt-2">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <TabButtonGroup
          options={modeOptions}
          value={mode}
          onValueChange={(value) => setMode(value as Mode)}
          size="sm"
        />
        <span className="ml-auto text-[11px] text-muted-foreground">{t(MODE_TIP_KEY[mode])}</span>
      </div>

      {replyTo && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-primary/60 bg-muted/50 px-2 py-1 text-xs">
          <span className="shrink-0 text-muted-foreground">
            {t('sessionManagement.replyTo', {
              name: replyTo.sender?.card || replyTo.sender?.nickname || replyTo.user_id,
            })}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground/70">
            {messageToText(replyTo) || t('sessionManagement.messageFallback')}
          </span>
          <button type="button" onClick={onClearReply} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {ats.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {ats.map((item) => (
            <span
              key={item.userId}
              className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary"
            >
              <AtSign className="h-3 w-3" />
              {item.name || item.userId}
              <button type="button" onClick={() => setAts((prev) => prev.filter((a) => a.userId !== item.userId))}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {mode === 'card' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">tuwen</span>
            <span className="text-[11px] text-muted-foreground">{t('sessionManagement.cardHint')}</span>
          </div>

          <div className="space-y-1.5">
            {CARD_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-2">
                <span className="w-[74px] shrink-0 font-mono text-[11px] text-muted-foreground">{field.key}</span>
                <Input
                  value={cardValues[field.key] ?? ''}
                  onChange={(event) => setCardValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                  placeholder={t(field.placeholderKey)}
                  className="h-7 text-xs"
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      ) : mode === 'rich' ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => mediaInput.current?.click()}
              disabled={disabled}
            >
              <FileUp className="mr-1 h-3.5 w-3.5" />
              {t('sessionManagement.selectFiles')}
            </Button>
            <span className="text-[11px] text-muted-foreground">{t('sessionManagement.richHint')}</span>
          </div>
          {attachments.length > 0 && renderAttachments(true, 'max-w-[200px]')}
        </div>
      ) : (
        <Textarea
          value={mode === 'markdown' ? markdown : text}
          onChange={(event) => (mode === 'markdown' ? setMarkdown(event.target.value) : setText(event.target.value))}
          onPaste={onPaste}
          placeholder={
            mode === 'markdown'
              ? t('sessionManagement.markdownPlaceholder')
              : t('sessionManagement.inputPlaceholder')
          }
          className={mode === 'markdown' ? 'min-h-[72px] resize-y font-mono text-xs' : 'min-h-[64px] resize-y text-sm'}
          disabled={disabled}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
        />
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode === 'plain' || mode === 'markdown' ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => imageInput.current?.click()}
            disabled={disabled}
            title={t('sessionManagement.selectImages')}
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
        ) : null}

        {(mode === 'plain' || mode === 'markdown') &&
          attachments.length > 0 &&
          renderAttachments(false, 'max-w-[160px]')}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {ats.length > 0 && `${t('sessionManagement.atCount', { count: ats.length })} · `}
            {totalAttachments > 0 &&
              t('sessionManagement.attachmentCount', { count: totalAttachments })}
          </span>
          <Button size="sm" className="h-8" onClick={() => void submit()} disabled={!canSend}>
            {sending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
            {t('sessionManagement.send')}
          </Button>
        </div>
      </div>

      <input
        ref={imageInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          addImages(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <input
        ref={mediaInput}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          addMedia(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
    </div>
  );
}
