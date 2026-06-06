import { Brain, Bot } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ServiceSwitchSectionProps {
  /** 当前 AI 服务总开关 */
  isAIEnabled: boolean;
  /** 国际化 */
  t: (key: string) => string;
  /** 切换总开关 */
  onChange: (checked: boolean) => void;
}

/**
 * AI 服务总开关。
 *
 * 内部已废弃独立页面（已合并至 `AIConfigPage` 顶部），但保留组件便于复用。
 */
export function ServiceSwitchSection({
  isAIEnabled,
  t,
  onChange,
}: ServiceSwitchSectionProps) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-primary" />
          {t('aiConfig.serviceSwitch.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAIEnabled
            ? t('aiConfig.serviceSwitch.enabledDesc')
            : t('aiConfig.serviceSwitch.disabledDesc')}
        </p>
      </div>

      <div className="flex items-center gap-5 p-5 rounded-2xl border border-border/30 bg-card/30">
        <div
          className={cn(
            'flex items-center justify-center flex-shrink-0 transition-all duration-500',
            isAIEnabled ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          <Brain className="w-8 h-8" strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">
              {t('aiConfig.serviceSwitch.title')}
            </span>
            <Badge
              variant={isAIEnabled ? 'default' : 'secondary'}
              className={cn(
                'text-xs font-medium',
                isAIEnabled &&
                  'bg-primary/15 text-primary hover:bg-primary/20 border-primary/20',
              )}
            >
              {isAIEnabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isAIEnabled
              ? t('aiConfig.serviceSwitch.enabledDesc')
              : t('aiConfig.serviceSwitch.disabledDesc')}
          </p>
        </div>
        <Switch
          checked={isAIEnabled}
          onCheckedChange={onChange}
          className="scale-110"
        />
      </div>
    </div>
  );
}
