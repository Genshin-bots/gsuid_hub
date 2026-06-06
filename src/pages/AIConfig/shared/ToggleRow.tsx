import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface ToggleRowProps {
  icon: React.ReactNode;
  iconColorClass: string;
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * 通用「图标 + 标题 + 描述 + 开关」行。
 * 记忆、表情包、向量库等设置项复用。
 */
export function ToggleRow({
  icon,
  iconColorClass,
  title,
  description,
  checked,
  onCheckedChange,
}: ToggleRowProps) {
  return (
    <div className="flex items-center gap-4 p-3 rounded-lg transition-colors duration-200 hover:bg-muted/30">
      <div
        className={cn(
          'flex items-center justify-center flex-shrink-0 transition-all duration-300',
          checked ? iconColorClass : 'text-muted-foreground',
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
