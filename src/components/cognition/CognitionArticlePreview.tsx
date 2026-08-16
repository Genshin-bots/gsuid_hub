import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  cognitionApi,
  getApiErrorMessage,
  type CognitionAttachment,
} from '@/lib/api';
import { toast } from 'sonner';

export function CognitionArticlePreview({
  article,
  onClose,
}: {
  article: CognitionAttachment | null;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!article) {
      setText('');
      setTruncated(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (!article.handle) {
        setText(article.summary || '');
        setTruncated(false);
        return;
      }
      setLoading(true);
      setText('');
      setTruncated(false);
      try {
        const data = await cognitionApi.readArticle(article.handle);
        if (cancelled) return;
        setText(data.text || article.summary || '');
        setTruncated(!!data.truncated);
      } catch (error) {
        if (cancelled) return;
        setText(article.summary || '');
        toast.error(getApiErrorMessage(error, t('aiMemory.articlePreviewFailed')));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [article, t]);

  return (
    <Dialog open={!!article} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass-card max-w-3xl max-h-[85vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-4 pb-3 border-b border-border/40 space-y-1">
          <DialogTitle className="pr-8 truncate">
            {article?.title || article?.ref || t('aiMemory.articlePreview')}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">
            {article?.handle || t('aiMemory.articlePreviewDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : text ? (
            <pre className="whitespace-pre-wrap break-words text-sm font-sans leading-relaxed">
              {text}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground">{t('aiMemory.articlePreviewEmpty')}</p>
          )}
          {truncated && !loading && (
            <p className="mt-3 text-xs text-muted-foreground">{t('aiMemory.articlePreviewTruncated')}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
