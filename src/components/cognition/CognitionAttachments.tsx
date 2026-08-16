import { useState } from 'react';
import { FileText, Pencil } from 'lucide-react';

import { CognitionArticlePreview } from '@/components/cognition/CognitionArticlePreview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CognitionAttachment } from '@/lib/api';

export function CognitionAttachments({
  attachments,
  emptyText,
  openLabel,
  writableLabel,
  readonlyLabel,
}: {
  attachments: CognitionAttachment[];
  emptyText?: string;
  openLabel: string;
  writableLabel: string;
  readonlyLabel: string;
}) {
  const [preview, setPreview] = useState<CognitionAttachment | null>(null);

  if (attachments.length === 0) {
    return emptyText ? (
      <p className="text-sm text-muted-foreground">{emptyText}</p>
    ) : null;
  }

  const slots = new Map<string, CognitionAttachment[]>();
  for (const att of attachments) {
    const slot = att.slot || '资料';
    const list = slots.get(slot) ?? [];
    list.push(att);
    slots.set(slot, list);
  }

  return (
    <div className="space-y-3">
      {[...slots.entries()].map(([slot, items]) => (
        <div key={slot} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{slot}</p>
          <div className="space-y-2">
            {items.map((att) => (
              <div
                key={`${att.node_id}-${att.ref || att.id || att.title}`}
                className="rounded-md border border-border/50 p-3 space-y-2"
              >
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{att.title || att.ref}</span>
                  <Badge variant={att.writable ? 'default' : 'outline'} className="shrink-0 text-[10px] gap-1">
                    {att.writable && <Pencil className="w-3 h-3" />}
                    {att.writable ? writableLabel : readonlyLabel}
                  </Badge>
                  {att.source && (
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {att.source}
                    </Badge>
                  )}
                </div>
                {att.summary && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                    {att.summary}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {att.as_of && <span>as_of={att.as_of}</span>}
                  {att.handle && <span className="font-mono break-all">handle={att.handle}</span>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => setPreview(att)}
                >
                  {openLabel}
                </Button>
              </div>
            ))}
          </div>
        </div>
      ))}

      <CognitionArticlePreview article={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
