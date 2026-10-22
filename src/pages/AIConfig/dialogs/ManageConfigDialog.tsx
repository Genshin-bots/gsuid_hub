import { useState } from 'react';
import { Copy, Plus, Server, Settings, Trash2, X } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '../shared/EmptyState';
import { cn } from '@/lib/utils';
import { ModelBrandIcon, ProviderBrandIcon } from '@/components/ui/model-brand-icon';
import type { AllConfigItem } from '@/lib/api';

export interface ManageConfigDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  allConfigsList: AllConfigItem[];
  highLevelConfig: string;
  lowLevelConfig: string;
  onOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onOpenEdit: (configName: string, provider: string) => void;
  onOpenDelete: (configName: string, provider: string) => void;
  onCopy: (provider: string, sourceName: string, newName: string) => Promise<boolean>;
}

function suggestCopyName(source: string, suffix: string, taken: Set<string>): string {
  const base = `${source}${suffix}`;
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}${Date.now()}`;
}

/**
 * 「管理配置文件」Dialog。
 * 展示当前所有 provider config，支持：
 * - 点击「编辑」跳到 EditConfigDialog
 * - 点击「删除」跳到 DeleteConfigDialog
 * - 点击「新建」跳到 CreateConfigDialog
 */
export function ManageConfigDialog({
  open,
  t,
  allConfigsList,
  highLevelConfig,
  lowLevelConfig,
  onOpenChange,
  onOpenCreate,
  onOpenEdit,
  onOpenDelete,
  onCopy,
}: ManageConfigDialogProps) {
  const [copyTarget, setCopyTarget] = useState<AllConfigItem | null>(null);
  const [draftName, setDraftName] = useState('');
  const [copying, setCopying] = useState(false);

  const openCopy = (configItem: AllConfigItem) => {
    const taken = new Set(
      allConfigsList
        .filter((item) => item.provider === configItem.provider)
        .map((item) => item.config_name),
    );
    setDraftName(suggestCopyName(configItem.config_name, t('aiConfig.copyConfigSuffix'), taken));
    setCopyTarget(configItem);
  };

  const confirmCopy = async () => {
    if (!copyTarget || copying) return;
    setCopying(true);
    try {
      const ok = await onCopy(copyTarget.provider, copyTarget.config_name, draftName);
      if (ok) setCopyTarget(null);
    } finally {
      setCopying(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col p-6 glass-card">
        <DialogHeader className="shrink-0 pb-1">
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            {t('aiConfig.manageConfig')}
          </DialogTitle>
          <DialogDescription>{t('aiConfig.manageConfigDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-2 space-y-2">
          {allConfigsList.length === 0 ? (
            <EmptyState
              icon={<Server className="w-8 h-8 text-muted-foreground/50" />}
              title={t('aiConfig.openaiConfig.noConfig')}
              description={t('aiConfig.taskConfig.emptyHint')}
            />
          ) : (
            allConfigsList.map((configItem) => {
              const usedByHigh = configItem.name === highLevelConfig;
              const usedByLow = configItem.name === lowLevelConfig;
              return (
                <div
                  key={`manage-${configItem.name}`}
                  className="flex items-center justify-between gap-2 p-3 rounded-xl glass-card transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <ModelBrandIcon
                      modelName={configItem.model_name}
                      provider={configItem.provider}
                      size={20}
                      className="text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {configItem.config_name}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px] h-4 px-1.5 gap-1',
                            configItem.provider === 'openai'
                              ? 'border-primary/40 text-primary bg-primary/10'
                              : configItem.provider === 'gemini'
                                ? 'border-blue-500/40 text-blue-600 bg-blue-500/10'
                                : 'border-orange-500/40 text-orange-600 bg-orange-500/10',
                          )}
                        >
                          <ProviderBrandIcon
                            provider={configItem.provider}
                            size={10}
                            className="shrink-0"
                          />
                          {configItem.provider === 'openai'
                            ? 'OpenAI'
                            : configItem.provider === 'anthropic'
                              ? 'Anthropic'
                              : configItem.provider === 'gemini'
                                ? 'Gemini'
                                : configItem.provider}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground truncate">
                          {configItem.model_name}
                        </span>
                        {usedByHigh && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {t('aiConfig.providerConfig.highLevel')}
                          </Badge>
                        )}
                        {usedByLow && (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                            {t('aiConfig.providerConfig.lowLevel')}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('aiConfig.copyConfig')}
                      aria-label={t('aiConfig.copyConfig')}
                      onClick={() => openCopy(configItem)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                      onClick={() => onOpenEdit(configItem.config_name, configItem.provider)}
                    >
                      <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => onOpenDelete(configItem.config_name, configItem.provider)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t border-border/40 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={onOpenCreate}
          >
            <Plus className="w-3.5 h-3.5" />
            {t('aiConfig.openaiConfig.createNew')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-3.5 h-3.5" />
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog
      open={copyTarget !== null}
      onOpenChange={(next) => {
        if (!next && !copying) setCopyTarget(null);
      }}
    >
      <DialogContent className="sm:max-w-[440px] glass-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-primary" />
            {t('aiConfig.copyConfig')}
          </DialogTitle>
          <DialogDescription>
            {t('aiConfig.copyConfigDesc', { name: copyTarget?.config_name ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="copyConfigName" className="font-semibold">
            {t('aiConfig.copyConfigName')}
          </Label>
          <Input
            id="copyConfigName"
            value={draftName}
            autoFocus
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmCopy();
              }
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={copying} onClick={() => setCopyTarget(null)}>
            {t('common.cancel')}
          </Button>
          <Button disabled={copying || !draftName.trim()} onClick={() => void confirmCopy()}>
            {t('common.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
