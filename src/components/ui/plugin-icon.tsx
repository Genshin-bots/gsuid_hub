import { useEffect, useState } from 'react';
import { Package } from 'lucide-react';
import { getPluginIconUrl } from '@/lib/api';
import { getPluginAvatarGradient, getPluginInitials } from '@/lib/pluginPage';
import { cn } from '@/lib/utils';

export interface PluginIconProps {
  pluginName: string;
  className?: string;
  /** 加载失败时的兜底图标 class */
  fallbackClassName?: string;
  /**
   * `default`：方形小图标，失败回退 Package 线框图标；
   * `avatar`：圆形图标（用于插件头像栈选择器），失败回退柔和弥散渐变 + 双字母缩写（对齐头像组风格）。
   */
  variant?: 'default' | 'avatar';
}

/**
 * 插件 ICON：走 `getPluginIconUrl`（含 core_command → public/ICON.png 等特例）。
 * 加载失败回退到 Package 图标（`avatar` 模式下回退弥散渐变 + 双字母缩写）。
 */
export function PluginIcon({
  pluginName,
  className = 'w-[18px] h-[18px]',
  fallbackClassName,
  variant = 'default',
}: PluginIconProps) {
  const [imgError, setImgError] = useState(false);
  const src = pluginName ? getPluginIconUrl(pluginName) : '';

  // 切换插件名时重置错误态，避免上一项失败导致下一项一直显示 fallback
  useEffect(() => {
    setImgError(false);
  }, [pluginName, src]);

  if (!pluginName || imgError) {
    if (variant === 'avatar') {
      const initials = getPluginInitials(pluginName);
      return (
        <span
          className={cn(
            'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none tracking-tight text-white shadow-inner',
            'text-[11px]',
            className,
            fallbackClassName,
          )}
          style={{
            backgroundImage: getPluginAvatarGradient(pluginName || 'plugin'),
            textShadow: '0 1px 2px rgba(0, 0, 0, 0.28)',
          }}
          aria-hidden
        >
          {initials}
        </span>
      );
    }

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
      className={cn(
        'block shrink-0',
        variant === 'avatar' ? 'rounded-full object-cover' : 'rounded-sm object-contain',
        className,
      )}
      alt=""
      width={variant === 'avatar' ? 36 : 18}
      height={variant === 'avatar' ? 36 : 18}
      draggable={false}
      onError={() => setImgError(true)}
    />
  );
}
