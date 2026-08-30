import { cn } from '@/lib/utils';

export function PageSpinner({ fullPage = false }: { fullPage?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center',
        fullPage ? 'min-h-screen bg-background' : 'flex-1 py-16',
      )}
      role="status"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}
