import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { getPluginIconUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PluginIconProps {
  pluginName: string;
  className?: string;
  /** 加载失败时的兜底图标 class */
  fallbackClassName?: string;
}

/**
 * 插件 ICON：走 `getPluginIconUrl`（含 core_command → public/ICON.png 等特例）。
 * 加载失败回退到 Package 图标。与 Plugins / GitUpdate / Database 等页共用。
 */
export function PluginIcon({
  pluginName,
  className = 'w-[18px] h-[18px]',
  fallbackClassName,
}: PluginIconProps) {
  const [imgError, setImgError] = useState(false);
  const src = pluginName ? getPluginIconUrl(pluginName) : '';

  // 切换插件名时重置错误态，避免上一项失败导致下一项一直显示 fallback
  useEffect(() => {
    setImgError(false);
  }, [pluginName, src]);

  if (!pluginName || imgError) {
    return (
      <Package
        className={cn('block shrink-0', className, 'text-muted-foreground/50', fallbackClassName)}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={src}
      className={cn('block shrink-0 rounded-sm object-contain', className)}
      alt=""
      width={18}
      height={18}
      draggable={false}
      onError={() => setImgError(true)}
    />
  );
}
