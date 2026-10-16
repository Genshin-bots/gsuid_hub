/**
 * 详情 Dialog 里的元数据行：<dl>/<dt>/<dd> 保证语义，font-mono 长 ID 不变形。
 * page-local helper，不进 components/ui：只服务产出物浏览这一块。
 */

export function MetaRow({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 min-w-0 ${className ?? ''}`}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd
        className={mono ? 'font-mono truncate min-w-0 flex-1' : 'truncate min-w-0 flex-1'}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
