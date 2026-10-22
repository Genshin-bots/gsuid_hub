import type { ReactNode } from 'react';

/**
 * 非英文界面在译文后挂原始透传参数。颜色和字体与译文分开，回传值仍是 raw。
 * 译文已经等于原文时不再重复一截括号。
 */
export function PassthroughOption({
  label,
  raw,
  showRaw,
}: {
  label: string;
  raw: string;
  showRaw: boolean;
}) {
  if (!showRaw || !raw || label === raw) return <>{label}</>;
  return (
    <span className="inline-flex min-w-0 max-w-full items-baseline gap-1.5">
      <span className="min-w-0 truncate">{label}</span>
      <span className="shrink-0 font-mono text-[11px] font-medium text-primary">[{raw}]</span>
    </span>
  );
}

export function passthroughRender(
  showRaw: boolean,
  labelOf: (raw: string) => string,
): (raw: string) => ReactNode {
  return (raw: string) => <PassthroughOption label={labelOf(raw)} raw={raw} showRaw={showRaw} />;
}
