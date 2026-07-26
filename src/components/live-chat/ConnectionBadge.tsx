import { cn } from '@/lib/utils';
import type { ConnectionState } from '@/lib/liveChat';
import { Loader2, Wifi, WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ConnectionBadgeProps {
  state: ConnectionState;
  label: string;
  className?: string;
}

const STATE_STYLE: Record<ConnectionState, string> = {
  connected: 'bg-green-500/15 text-green-600 border-green-500/30',
  connecting: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  reconnecting: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  disconnected: 'bg-muted text-muted-foreground border-border/50',
  error: 'bg-red-500/15 text-red-600 border-red-500/30',
};

export function ConnectionBadge({ state, label, className }: ConnectionBadgeProps) {
  const Icon =
    state === 'connected'
      ? Wifi
      : state === 'error'
        ? AlertTriangle
        : state === 'connecting' || state === 'reconnecting'
          ? Loader2
          : WifiOff;

  const spinning = state === 'connecting' || state === 'reconnecting';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 font-normal whitespace-normal max-w-full',
        STATE_STYLE[state],
        className,
      )}
    >
      {spinning ? (
        <Loader2 className="w-3 h-3 shrink-0 animate-spin" />
      ) : state === 'reconnecting' ? (
        <RefreshCw className="w-3 h-3 shrink-0" />
      ) : (
        <Icon className="w-3 h-3 shrink-0" />
      )}
      <span className="truncate">{label}</span>
    </Badge>
  );
}
