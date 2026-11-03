/**
 * 一个消息段的渲染。
 *
 * 段结构由后端 `message_history/segments.py` 生成，这里只管显示。markdown 走
 * marked + DOMPurify（`breaks: true`，单换行就是一行）。
 */
import { useMemo, useState } from 'react';
import { ChevronRight, ExternalLink, FileText, ImageOff, Quote } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { INLINE_CMD_PREFIX, assetUrl, markdownToHtml, type BtnItem, type MsgSeg } from '@/lib/sessionChat';

/** 缩略宽度 */
const IMG_W = 320;
/** 引用块里的预览宽度：只是提示「引用的是哪条」，别占满一行 */
const QUOTE_IMG_W = 120;

interface SegmentViewProps {
  seg: MsgSeg;
  /** 引用块里的小图，按预览尺寸渲染 */
  compact?: boolean;
}

function ImageSeg({ seg, compact }: { seg: MsgSeg; compact?: boolean }) {
  const { t } = useLanguage();
  const src = assetUrl(seg.url);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState(false);
  const maxW = compact ? QUOTE_IMG_W : IMG_W;

  if (!src) {
    // 非直链（本地路径）原样显示路径：内容没有进内存，浏览器也就取不到
    if (seg.name) {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 font-mono text-xs break-all text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5 shrink-0" />
          {seg.name}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
        <ImageOff className="h-3.5 w-3.5" />
        {seg.error || t('sessionManagement.imageLoadFailed')}
      </span>
    );
  }

  if (failed) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1 text-xs text-muted-foreground">
        <ImageOff className="h-3.5 w-3.5" />
        {seg.error || t('sessionManagement.imageLoadFailed')}
      </span>
    );
  }

  return (
    <>
      <span
        className="my-1 block w-fit max-w-full cursor-zoom-in overflow-hidden rounded-lg border border-border/40"
        style={{ maxWidth: maxW }}
        onClick={() => setPreview(true)}
      >
        <img
          src={src}
          alt={seg.name || t('sessionManagement.nodeImage')}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="block max-w-full"
          onError={() => setFailed(true)}
        />
      </span>
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{t('sessionManagement.imagePreview')}</DialogTitle>
          <img
            src={src}
            alt={seg.name || t('sessionManagement.nodeImage')}
            referrerPolicy="no-referrer"
            className="mx-auto max-h-[80vh] w-auto"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function MediaSeg({ seg, kind }: { seg: MsgSeg; kind: 'record' | 'video' }) {
  const { t } = useLanguage();
  const src = assetUrl(seg.url);
  const [failed, setFailed] = useState(false);

  if (!src) {
    // 没留内容时只显示类型占位；只有后端明确说过期了才带「已过期」
    const label = t(kind === 'video' ? 'sessionManagement.nodeVideo' : 'sessionManagement.nodeAudio');
    return <span className="text-xs text-muted-foreground">{seg.error || `[${label}]`}</span>;
  }

  if (failed) {
    return (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-primary hover:bg-primary/10"
      >
        <FileText className="h-3.5 w-3.5" />
        {seg.error || t(kind === 'video' ? 'sessionManagement.nodeVideo' : 'sessionManagement.nodeAudio')}
      </a>
    );
  }

  return kind === 'video' ? (
    <video
      src={src}
      controls
      onError={() => setFailed(true)}
      className="my-1 block max-h-[280px] max-w-full rounded-lg"
    />
  ) : (
    <audio src={src} controls onError={() => setFailed(true)} className="my-1 block max-w-[280px]" />
  );
}

function ForwardSeg({ seg }: { seg: MsgSeg }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const items = seg.items ?? [];
  return (
    <div className="my-1 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-xs text-foreground/80 hover:bg-muted/50"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        {t('sessionManagement.forwardSummary', { count: seg.count ?? items.length })}
      </button>
      {open && (
        <div className="max-h-72 space-y-1.5 overflow-y-auto border-t border-border/40 px-2.5 py-2">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('sessionManagement.forwardTruncated')}</p>
          )}
          {items.map((row, idx) => (
            <div key={idx} className="rounded-md bg-background/70 px-2 py-1 text-xs">
              {row.map((child, childIdx) => (
                <SegmentView key={childIdx} seg={child} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 引用段：被引用的文字 + 图片 / 文件 / 合并转发都挂在 reply 段上 */
function ReplySeg({ seg }: { seg: MsgSeg }) {
  const { t } = useLanguage();
  const images = seg.images ?? [];
  const files = seg.files ?? [];
  return (
    <div className="rounded-md border-l-2 border-primary/30 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Quote className="h-3 w-3" />
        {t('sessionManagement.quote')} {seg.id ? `#${seg.id}` : ''}
      </span>
      {images.length > 0 && (
        <div className="mt-1 flex flex-wrap items-start gap-1">
          {images.map((img, idx) => (
            <ImageSeg key={idx} seg={img} compact />
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {files.map((file, idx) => (
            <SegmentView key={idx} seg={file} compact />
          ))}
        </div>
      )}
      {seg.node && <ForwardSeg seg={seg.node} />}
    </div>
  );
}

/** 按钮配色：与 QQ 客户端一致，`style` 决定线框还是实心 */
const BUTTON_TONE: Record<number, string> = {
  0: 'seg-btn--plain',
  1: 'seg-btn--primary',
  2: 'seg-btn--plain',
  3: 'seg-btn--danger',
  4: 'seg-btn--solid',
};

/** 按钮带的原始数据：命令按钮是命令，跳转按钮是 URL */
function buttonData(btn: BtnItem): string {
  return btn.data || btn.callback || btn.input || btn.link || '';
}

/** 跳转类按钮：action=0，或者数据本身就是个链接 */
function isLinkButton(btn: BtnItem): boolean {
  if (btn.action === 0) return true;
  return /^(https?:\/\/|mqqapi:\/\/)/i.test(buttonData(btn));
}

/** 点按钮看原始数据：按钮段和 markdown 内联按钮共用这一个弹窗 */
function RawDataDialog({
  data,
  onClose,
  link,
}: {
  data: unknown;
  onClose: () => void;
  link?: string;
}) {
  const { t } = useLanguage();
  return (
    <Dialog open={data !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{t('sessionManagement.buttonData')}</DialogTitle>
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted/50 p-3 text-xs">
          {JSON.stringify(data ?? {}, null, 2)}
        </pre>
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 self-start text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t('sessionManagement.openLink')}
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ButtonSeg({ seg }: { seg: MsgSeg }) {
  const { t } = useLanguage();
  const rows = seg.rows ?? [];
  const [raw, setRaw] = useState<BtnItem | null>(null);

  if (!rows.length) {
    return (
      <details className="text-xs text-muted-foreground">
        <summary>{t('sessionManagement.buttonUnparsed')}</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">{seg.raw}</pre>
      </details>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {rows.map((row, idx) => (
          <div key={idx} className="seg-btn-row">
            {row.map((btn, btnIdx) => {
              const label = btn.text || buttonData(btn) || t('sessionManagement.buttonFallback');
              const tone = BUTTON_TONE[Number(btn.style ?? 1)] ?? 'seg-btn--primary';
              return (
                <button
                  key={btnIdx}
                  type="button"
                  className={cn('seg-btn', tone)}
                  onClick={() => setRaw(btn)}
                >
                  {isLinkButton(btn) && <ExternalLink className="seg-btn__link" aria-hidden />}
                  <span className="min-w-0 truncate">{label}</span>
                  {btn.limited && (
                    <span className="text-[10px] opacity-70">{t('sessionManagement.buttonLimited')}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <RawDataDialog
        data={raw}
        onClose={() => setRaw(null)}
        link={raw && isLinkButton(raw) ? buttonData(raw) : undefined}
      />
    </>
  );
}

function MarkdownSeg({ seg }: { seg: MsgSeg }) {
  const { t } = useLanguage();
  const html = useMemo(() => markdownToHtml(seg.content ?? ''), [seg.content]);
  const [raw, setRaw] = useState<{ command: string; href: string } | null>(null);

  if (!html) {
    return (
      <details className="text-xs text-muted-foreground">
        <summary>{t('sessionManagement.markdownTemplateHint')}</summary>
        <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all">
          {seg.raw ?? JSON.stringify(seg.template ?? {}, null, 2)}
        </pre>
      </details>
    );
  }
  return (
    <>
      <div
        className="seg-md text-sm leading-relaxed"
        onClick={(event) => {
          const anchor = (event.target as HTMLElement).closest('a');
          const href = anchor?.getAttribute('href') ?? '';
          if (!href.startsWith(INLINE_CMD_PREFIX)) return;
          event.preventDefault();
          setRaw({ command: decodeURIComponent(href.slice(INLINE_CMD_PREFIX.length)), href });
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <RawDataDialog data={raw} onClose={() => setRaw(null)} />
    </>
  );
}

function ArkSeg({ seg }: { seg: MsgSeg }) {
  const { t } = useLanguage();
  const kv = seg.kv ?? [];
  return (
    <div className="my-1 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-2 text-xs">
      <div className="mb-1 flex items-center gap-1 font-medium text-foreground/80">
        <FileText className="h-3.5 w-3.5" />
        {t('sessionManagement.card')}
        {seg.templateId ? ` · ${t('sessionManagement.cardTemplate', { id: seg.templateId })}` : ''}
      </div>
      {kv.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          {kv.map((item, idx) => (
            <div key={idx} className="contents">
              <dt className="text-muted-foreground">{item.key}</dt>
              <dd className="break-all">{item.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
          {seg.raw}
        </pre>
      )}
    </div>
  );
}

export function SegmentView({ seg, compact }: SegmentViewProps) {
  const { t } = useLanguage();
  switch (seg.type) {
    case 'text':
      return <span className="whitespace-pre-wrap break-words">{seg.text}</span>;

    case 'at':
      return (
        <span className="mx-0.5 rounded bg-primary/10 px-1 text-primary">
          @{seg.name || seg.qq}
        </span>
      );

    case 'reply':
      return <ReplySeg seg={seg} />;

    case 'image':
      return <ImageSeg seg={seg} compact={compact} />;

    case 'record':
      return <MediaSeg seg={seg} kind="record" />;

    case 'video':
      return <MediaSeg seg={seg} kind="video" />;

    case 'file':
      return seg.url ? (
        <a
          href={assetUrl(seg.url)}
          target="_blank"
          rel="noopener noreferrer"
          referrerPolicy="no-referrer"
          download={seg.name || undefined}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs text-primary hover:bg-primary/10"
        >
          <FileText className="h-3.5 w-3.5" />
          {seg.name || t('sessionManagement.file')}
        </a>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          {seg.name || t('sessionManagement.file')}
          {seg.error ? `（${seg.error}）` : ''}
        </span>
      );

    case 'face':
      return (
        <span className="text-muted-foreground">
          [{t('sessionManagement.face', { id: seg.id ?? '' })}]
        </span>
      );

    case 'forward':
      return <ForwardSeg seg={seg} />;

    case 'markdown':
      return <MarkdownSeg seg={seg} />;

    case 'button':
      return <ButtonSeg seg={seg} />;

    case 'ark':
      return <ArkSeg seg={seg} />;

    default:
      return (
        <span className="text-muted-foreground">
          {seg.text ||
            t('sessionManagement.unknownSeg', {
              kind: seg.kind || t('sessionManagement.unknownSegName'),
            })}
        </span>
      );
  }
}
