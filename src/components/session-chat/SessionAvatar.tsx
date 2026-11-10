/**
 * 会话头像。
 *
 * 官机拿不到群头像（库里是空的），用名字首字做占位，
 * 图片加载失败也退到占位，不要留一个碎图。
 *
 * 单独一个文件是为了让 `SessionList.tsx` 只导出组件 —— 混着导出工具函数会触发
 * `react-refresh/only-export-components`，热更新失效。
 */
import { useState } from 'react';
import { Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { assetUrl } from '@/lib/sessionChat';

interface SessionAvatarProps {
  src?: string;
  name?: string;
  type?: 'group' | 'private';
  className?: string;
}

export function SessionAvatar({ src, name, type, className }: SessionAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const url = src && failedSrc !== src ? assetUrl(src) : '';
  const initial = (name ?? '').trim().slice(0, 1);

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium text-muted-foreground',
        className ?? 'h-8 w-8',
      )}
    >
      {url ? (
        <img
          src={url}
          alt={name ?? ''}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedSrc(src ?? null)}
        />
      ) : initial ? (
        <span>{initial}</span>
      ) : type === 'private' ? (
        <User className="h-4 w-4" />
      ) : (
        <Users className="h-4 w-4" />
      )}
    </span>
  );
}
