/**
 * First-class State Store browser (AI persistent state).
 * Reuses StateStoreViewer previously only embedded in Kanban.
 */
import { useRef, useState } from 'react';
import { Database, Trash2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { PinnedPage } from '@/components/layout/PinnedPage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import StateStoreViewer, { type StateStoreViewerHandle } from '@/components/StateStoreViewer';

export default function StateStorePage() {
  const { t } = useLanguage();
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const ref = useRef<StateStoreViewerHandle>(null);
  const [selectedCount, setSelectedCount] = useState(0);

  return (
    <PinnedPage
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 overflow-x-auto">
            <h1 className="whitespace-nowrap text-3xl font-bold flex items-center gap-3">
              <Database className="w-8 h-8 shrink-0" />
              {t('stateStore.title')}
            </h1>
            <p className="whitespace-nowrap text-muted-foreground mt-1">
              {t('stateStore.description')}
            </p>
          </div>
          <Button
            variant="outline"
            className="h-9 whitespace-nowrap self-end sm:self-auto"
            disabled={selectedCount === 0}
            onClick={() => ref.current?.openBatchDelete()}
          >
            <Trash2 className="w-4 h-4" />
            {t('stateStore.batchDelete')}
            {selectedCount > 0 ? ` (${selectedCount})` : ''}
          </Button>
        </div>
      }
      className={cn(isGlass && 'glass-page')}
    >
      <div className="px-0 pb-2">
        <StateStoreViewer ref={ref} onSelectionChange={setSelectedCount} />
      </div>
    </PinnedPage>
  );
}
