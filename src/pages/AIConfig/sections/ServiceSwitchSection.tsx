import { Brain, Bot } from 'lucide-react';
import { pageStackClass } from '@/components/layout/PinnedPage';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ConfigCard, SettingRow } from '../shared';

export interface ServiceSwitchSectionProps {
  /** 当前 AI 服务总开关 */
  isAIEnabled: boolean;
  /** 国际化 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 切换总开关 */
  onChange: (checked: boolean) => void;
}

/**
 * AI 服务总开关。
 *
 * 内部已废弃独立页面（已合并至 `AIConfigPage` 顶部），但保留组件便于复用。
 */
export function ServiceSwitchSection({ isAIEnabled, t, onChange }: ServiceSwitchSectionProps) {
  return (
    <div className={pageStackClass}>
      <ConfigCard
        icon={<Bot className="w-5 h-5 text-primary" />}
        title={t('aiConfig.serviceSwitch.title')}
        description={
          isAIEnabled
            ? t('aiConfig.serviceSwitch.enabledDesc')
            : t('aiConfig.serviceSwitch.disabledDesc')
        }
      >
        <SettingRow
          icon={
            <Brain
              className={cn(
                'w-8 h-8 transition-colors duration-500',
                isAIEnabled ? 'text-primary' : 'text-muted-foreground',
              )}
              strokeWidth={1.5}
            />
          }
          title={
            <span className="flex items-center gap-3">
              {t('aiConfig.serviceSwitch.title')}
              <Badge
                variant={isAIEnabled ? 'default' : 'secondary'}
                className={cn(
                  'text-xs font-medium',
                  isAIEnabled && 'bg-primary/15 text-primary hover:bg-primary/20 border-primary/20',
                )}
              >
                {isAIEnabled ? t('common.enabled') : t('common.disabled')}
              </Badge>
            </span>
          }
          description={
            <span className="text-sm">
              {isAIEnabled
                ? t('aiConfig.serviceSwitch.enabledDesc')
                : t('aiConfig.serviceSwitch.disabledDesc')}
            </span>
          }
          control={
            <Switch checked={isAIEnabled} onCheckedChange={onChange} className="scale-110" />
          }
        />
      </ConfigCard>
    </div>
  );
}
