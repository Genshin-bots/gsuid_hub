import {
  AlertTriangle,
  Cpu,
  Globe,
  Key,
  Loader2,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigField } from '@/components/config';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { ModelSelectDropdown } from '@/components/ui/model-select-dropdown';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getModelCapabilities, type ModelCapability } from '../constants';
import type { OpenAIConfigData, ProviderConfigOptions } from '@/lib/api';

export interface EditConfigDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  configName: string;
  data: OpenAIConfigData | null;
  isLoading: boolean;
  isSaving: boolean;
  providerConfigOptions: ProviderConfigOptions | null;
  fetchedModels: string[];
  isFetching: boolean;
  baseUrlHasTrailingSlash: (url: string) => boolean;
  onOpenChange: (open: boolean) => void;
  onChangeField: (field: keyof OpenAIConfigData, value: string | string[]) => void;
  onToggleCapability: (cap: string) => void;
  onSave: () => void;
}

export function EditConfigDialog({
  open,
  t,
  configName,
  data,
  isLoading,
  isSaving,
  providerConfigOptions,
  fetchedModels,
  isFetching,
  baseUrlHasTrailingSlash,
  onOpenChange,
  onChangeField,
  onToggleCapability,
  onSave,
}: EditConfigDialogProps) {
  const capabilities: ModelCapability[] = getModelCapabilities(t);
  const showBaseUrlWarning = data ? baseUrlHasTrailingSlash(data.base_url) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            {t('aiConfig.openaiConfig.editConfigTitle')}
          </DialogTitle>
          <DialogDescription>{configName}</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('aiConfig.serviceProvider.apiBaseUrl')}
              </Label>
              <InputWithDropdown
                value={data.base_url}
                onChange={(val) => onChangeField('base_url', val)}
                options={providerConfigOptions?.options?.base_url || []}
                placeholder="选择或输入 API Base URL"
                inputPlaceholder="输入或选择 API Base URL"
                className={showBaseUrlWarning ? 'border-red-500 text-red-600 dark:text-red-400' : undefined}
              />
              {showBaseUrlWarning && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('aiConfig.openaiConfig.baseUrlTrailingSlashWarning')}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Key className="w-4 h-4" />
                {t('aiConfig.serviceProvider.apiKey')}
              </Label>
              <ConfigField
                fieldKey="api_key"
                field={{
                  type: 'tags',
                  label: 'api_key',
                  value: data.api_key || [],
                  placeholder: '输入API密钥（支持多个）',
                  description: '',
                }}
                showLabel={false}
                onChange={(_k, v) => onChangeField('api_key', v as string[])}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                {t('aiConfig.serviceProvider.apiModel')}
              </Label>
              <ModelSelectDropdown
                value={data.model_name}
                onChange={(val) => onChangeField('model_name', val)}
                presetOptions={providerConfigOptions?.options?.model_name || []}
                discoveredModels={fetchedModels}
                isFetching={isFetching}
                placeholder="选择或输入模型名称"
                inputPlaceholder="输入或选择模型名称"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('aiConfig.serviceProvider.modelCapabilities')}
              </Label>
              <div className="flex flex-wrap gap-2">
                {capabilities.map((cap) => {
                  const modelSupport = Array.isArray(data.model_support) ? data.model_support : ['text'];
                  const isSelected = modelSupport.includes(cap.value);
                  const Icon = cap.icon;
                  return (
                    <button
                      key={cap.value}
                      type="button"
                      onClick={() => onToggleCapability(cap.value)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:border-primary/30 text-muted-foreground',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {cap.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            {t('aiConfig.openaiConfig.noConfig')}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
