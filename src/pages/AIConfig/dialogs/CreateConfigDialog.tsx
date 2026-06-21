import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Gauge,
  Plus,
  Server,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfigField } from '@/components/config';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { ModelSelectDropdown } from '@/components/ui/model-select-dropdown';
import { Label } from '@/components/ui/label';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { getModelCapabilities } from '../constants.tsx';
import type { ProviderConfigOptions } from '@/lib/api';

export interface CreateConfigDialogProps {
  open: boolean;
  t: (key: string) => string;

  provider: string;
  configName: string;
  baseUrl: string;
  apiKeys: string[];
  model: string;
  embeddingModel: string;
  modelSupport: string[];
  modelEffort: string;
  fetchedModels: string[];
  isFetching: boolean;

  providerConfigOptions: ProviderConfigOptions | null;

  baseUrlHasTrailingSlash: (url: string) => boolean;

  onOpenChange: (open: boolean) => void;
  onChangeProvider: (provider: string) => void;
  onFetchProviderConfigOptions: (provider: string) => void;
  onChangeConfigName: (v: string) => void;
  onChangeBaseUrl: (v: string) => void;
  onChangeApiKeys: (v: string[]) => void;
  onChangeModel: (v: string) => void;
  onChangeEmbeddingModel: (v: string) => void;
  onChangeModelEffort: (v: string) => void;
  onChangeModelSupport: (v: string[]) => void;
  onReset: () => void;
  onSubmit: () => void;
}

/**
 * 「新建配置文件」Dialog。
 * 支持 OpenAI 兼容格式 / Anthropic 格式，提供：
 * - provider / config name / base url / api keys / model
 * - 能力多选（text / image / audio / video）
 * - 实时从远端拉取模型列表（debounced）
 */
export function CreateConfigDialog(props: CreateConfigDialogProps) {
  const {
    open,
    t,
    provider,
    baseUrl,
    apiKeys,
    model,
    modelSupport,
    modelEffort,
    fetchedModels,
    isFetching,
    providerConfigOptions,
    baseUrlHasTrailingSlash,
    onOpenChange,
    onChangeProvider,
    onFetchProviderConfigOptions,
    onChangeConfigName,
    onChangeBaseUrl,
    onChangeApiKeys,
    onChangeModel,
    onChangeModelEffort,
    onChangeModelSupport,
    onReset,
    onSubmit,
  } = props;

  // 内部使用 useState 仅用于受控 Input 的 configName
  const [configName, setConfigName] = useState(props.configName);
  useEffect(() => {
    setConfigName(props.configName);
  }, [props.configName]);

  const capabilities = getModelCapabilities(t);
  const showBaseUrlWarning = baseUrlHasTrailingSlash(baseUrl);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onReset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[520px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t('aiConfig.openaiConfig.createNew')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('aiConfig.providerConfig.provider')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={provider === 'openai' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  onChangeProvider('openai');
                  onFetchProviderConfigOptions('openai');
                }}
              >
                <Server className="w-4 h-4" />OpenAI 兼容格式
              </Button>
              <Button
                type="button"
                variant={provider === 'anthropic' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  onChangeProvider('anthropic');
                  onFetchProviderConfigOptions('anthropic');
                }}
              >
                <Brain className="w-4 h-4" />Anthropic 格式
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="configName">
              {t('aiConfig.openaiConfig.configName')}
            </Label>
            <Input
              id="configName"
              value={configName}
              onChange={(e) => {
                setConfigName(e.target.value);
                onChangeConfigName(e.target.value);
              }}
              placeholder={t('aiConfig.openaiConfig.configNamePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('aiConfig.serviceProvider.apiBaseUrl')}</Label>
            <InputWithDropdown
              value={baseUrl}
              onChange={onChangeBaseUrl}
              options={providerConfigOptions?.options?.base_url || []}
              placeholder="选择或输入 API Base URL"
              inputPlaceholder="https://api.openai.com/v1"
              className={
                showBaseUrlWarning
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : undefined
              }
            />
            {showBaseUrlWarning && (
              <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {t('aiConfig.openaiConfig.baseUrlTrailingSlashWarning')}
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t('aiConfig.serviceProvider.apiKey')}</Label>
            <ConfigField
              fieldKey="api_key"
              field={{
                type: 'tags',
                label: 'api_key',
                value: apiKeys,
                placeholder: '输入API密钥（支持多个）',
                description: '',
              }}
              showLabel={false}
              onChange={(_k, v) => onChangeApiKeys(v as string[])}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('aiConfig.serviceProvider.apiModel')}</Label>
            <ModelSelectDropdown
              value={model}
              onChange={onChangeModel}
              presetOptions={providerConfigOptions?.options?.model_name || []}
              discoveredModels={fetchedModels}
              isFetching={isFetching}
              placeholder="选择或输入模型名称"
              inputPlaceholder="gpt-4o-mini"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('aiConfig.serviceProvider.modelCapabilities')}</Label>
            <ChipGroup
              options={capabilities}
              value={modelSupport}
              onValueChange={onChangeModelSupport}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('aiConfig.serviceProvider.modelEffort')}</Label>
            <InputWithDropdown
              value={modelEffort}
              onChange={onChangeModelEffort}
              options={[
                'enable',
                'disable',
                'minimal',
                'low',
                'medium',
                'high',
                'xhigh',
              ]}
              placeholder="选择思考等级"
              inputPlaceholder="选择思考等级"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onReset();
              onOpenChange(false);
            }}
          >
            {t('common.cancel')}
          </Button>
          <Button onClick={onSubmit}>{t('common.confirm')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
