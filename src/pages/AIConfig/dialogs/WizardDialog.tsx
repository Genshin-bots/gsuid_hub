import {
  AlertTriangle,
  Bot,
  CheckCircle,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { PersonaAvatar } from '../shared/PersonaAvatar';
import type {
  AIWizardChecklistItem,
  AIWizardStatusResponse,
} from '@/lib/api';

export interface WizardDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  overallStatus: 'overall_ok' | 'overall_warning' | 'overall_error';
  usable: boolean;
  summary: { total: number; ok: number; warning: number; error: number };
  checklist: AIWizardChecklistItem[];
  status: AIWizardStatusResponse | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 「AI 配置状态检查」Dialog（俗称「向导」）。
 *
 * 展示：
 * - 总体 OK / Warning / Error 横幅
 * - 人格（Persona）启用范围 / scope 信息
 * - 检查项清单（过滤掉 ai_enable / ai_range / persona 三项，
 *   这三项已经在上面的人格区域有所体现）
 */
export function WizardDialog({
  open,
  t,
  isLoading,
  overallStatus,
  usable,
  summary,
  checklist,
  status,
  onOpenChange,
}: WizardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            {t('aiConfig.wizard.title')}
          </DialogTitle>
          <DialogDescription>{t('aiConfig.wizard.description')}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Overall Status Banner */}
            <div
              className={cn(
                'p-4 rounded-lg border flex items-center gap-3',
                overallStatus === 'overall_ok' &&
                  'bg-green-500/10 border-green-500/20',
                overallStatus === 'overall_warning' &&
                  'bg-yellow-500/10 border-yellow-500/20',
                overallStatus === 'overall_error' &&
                  'bg-red-500/10 border-red-500/20',
              )}
            >
              {overallStatus === 'overall_ok' && (
                <CheckCircle className="w-6 h-6 text-green-500" />
              )}
              {overallStatus === 'overall_warning' && (
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              )}
              {overallStatus === 'overall_error' && (
                <AlertTriangle className="w-6 h-6 text-red-500" />
              )}
              <div>
                <p className="font-medium">
                  {usable
                    ? t('aiConfig.wizard.aiUsable')
                    : t('aiConfig.wizard.aiNotUsable')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('aiConfig.wizard.summary', {
                    total: summary.total,
                    ok: summary.ok,
                    warning: summary.warning,
                  })}
                </p>
              </div>
            </div>

            {/* Persona List Section */}
            {status?.persona && (
              <div className="p-3 rounded-lg border bg-muted/30 border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t('aiConfig.wizard.personaList') || '人格配置'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({status.persona.note})
                  </span>
                </div>
                {/* AI Enable Range Info */}
                {status?.ai_enable_range &&
                  status.ai_enable_range.mode !== 'all' && (
                    <div className="mb-2 p-2 rounded bg-muted/50 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {status.ai_enable_range.mode === 'white_list'
                            ? t('aiConfig.wizard.whitelistNote') || '白名单'
                            : t('aiConfig.wizard.blacklistNote') || '黑名单'}
                          :
                        </span>
                        <Badge variant="default" className="text-[10px]">
                          {status.ai_enable_range.mode}
                        </Badge>
                      </div>
                      <div className="ml-5 space-y-0.5">
                        {status.ai_enable_range.mode === 'white_list' &&
                          status.ai_enable_range.white_list.map((userId, idx) => (
                            <p key={idx} className="text-muted-foreground/70">
                              ✓ {userId}
                            </p>
                          ))}
                        {status.ai_enable_range.mode === 'black_list' &&
                          status.ai_enable_range.black_list.map((userId, idx) => (
                            <p key={idx} className="text-muted-foreground/70">
                              ✗ {userId}
                            </p>
                          ))}
                      </div>
                    </div>
                  )}
                <div
                  className={cn(
                    'grid gap-3',
                    status.persona.personas.length > 1
                      ? 'grid-cols-2'
                      : 'grid-cols-1',
                  )}
                >
                  {status.persona.personas.map((persona, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'p-3 rounded-lg border text-xs',
                        persona.is_enabled
                          ? 'bg-green-500/5 border-green-500/10'
                          : 'bg-muted border-muted',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <div className="relative w-8 h-8 flex-shrink-0">
                          <PersonaAvatar
                            name={persona.name}
                            isEnabled={persona.is_enabled}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {persona.is_enabled ? (
                              <CheckCircle className="w-3 h-3 text-green-500" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-muted-foreground" />
                            )}
                            <span className="font-medium">{persona.name}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge variant="default" className="text-[10px]">
                          {persona.scope === 'global' &&
                            t('aiConfig.wizard.scopeGlobal')}
                          {persona.scope === 'global_group' &&
                            t('aiConfig.wizard.scopeGlobalGroup')}
                          {persona.scope === 'global_private' &&
                            t('aiConfig.wizard.scopeGlobalPrivate')}
                          {persona.scope === 'specific' &&
                            t('aiConfig.wizard.scopeSpecific')}
                          {persona.scope === 'disabled' &&
                            t('aiConfig.wizard.scopeDisabled')}
                        </Badge>
                        {persona.has_inspect && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t('aiConfig.wizard.inspect') || '巡检'}(
                            {persona.inspect_interval})
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        {persona.scope_desc}
                      </p>
                      {persona.scope === 'specific' &&
                        persona.target_groups.length > 0 && (
                          <div className="mt-1.5 space-y-0.5">
                            {persona.target_groups.map((group, gIdx) => (
                              <p
                                key={gIdx}
                                className="text-muted-foreground/70 text-[10px] ml-1"
                              >
                                ├ {group}
                              </p>
                            ))}
                          </div>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Checklist Items */}
            <div className="grid grid-cols-2 gap-3">
              {checklist
                .filter(
                  (item) =>
                    item.id !== 'ai_enable' &&
                    item.id !== 'ai_range' &&
                    item.id !== 'persona',
                )
                .map((item) => (
                  <TooltipProvider key={item.id} delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'p-3 rounded-lg border flex items-start gap-3 cursor-help',
                            item.status === 'ok' &&
                              'bg-green-500/5 border-green-500/10',
                            item.status === 'warning' &&
                              'bg-yellow-500/5 border-yellow-500/10',
                            item.status === 'error' &&
                              'bg-red-500/5 border-red-500/10',
                          )}
                        >
                          {item.status === 'ok' && (
                            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          )}
                          {item.status === 'warning' && (
                            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                          )}
                          {item.status === 'error' && (
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                {item.name}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {item.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.message}
                            </p>
                          </div>
                        </div>
                      </TooltipTrigger>
                      {item.id === 'memory' && item.status === 'warning' && (
                        <TooltipContent side="top" className="max-w-xs">
                          <p>
                            {t('aiConfig.wizard.memoryWarningTip') ||
                              '全部群聊模式会处理所有群聊的记忆，可能占用较多 Token'}
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
