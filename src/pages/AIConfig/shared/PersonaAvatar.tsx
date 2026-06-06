import { useState } from 'react';
import { Bot } from 'lucide-react';
import { personaApi } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface PersonaAvatarProps {
  name: string;
  isEnabled: boolean;
}

/**
 * 角色头像：
 * - 优先从 `personaApi.getAvatarUrl` 拉取远程头像
 * - 加载失败时回退到 Bot 图标
 * - 当人格被禁用时整体置灰
 */
export function PersonaAvatar({ name, isEnabled }: PersonaAvatarProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center">
      {!imgError ? (
        <img
          src={personaApi.getAvatarUrl(name, Date.now())}
          alt={name}
          className={cn('w-full h-full object-cover', !isEnabled && 'opacity-50')}
          onError={() => setImgError(true)}
        />
      ) : (
        <Bot
          className={cn(
            'w-4 h-4',
            isEnabled ? 'text-primary' : 'text-muted-foreground',
          )}
        />
      )}
    </div>
  );
}
