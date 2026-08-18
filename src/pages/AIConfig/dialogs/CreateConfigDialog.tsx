import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Fingerprint,
  Gauge,
  Hash,
  Info,
  Key,
  KeyRound,
  Plus,
  Plug2,
  Search,
  Server,
  TrendingUp,
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
import { Input } from '@/components/ui/input';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { ModelSelectDropdown } from '@/components/ui/model-select-dropdown';
import { Label } from '@/components/ui/label';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { ProviderBrandIcon } from '@/components/ui/model-brand-icon';
import { getModelCapabilities } from '../constants.tsx';
import {
  getModelEffortLabel,
  getUsageStatsModeLabel,
  getRequestMethodLabel,
  getRequestMethodDescription,
  getRemoteWebSearchLabel,
  getRemoteWebSearchDescription,
  getSendBackThinkingLabel,
  getForwardEndUserIdLabel,
  getForwardEndUserIdDescription,
} from '../constants.tsx';
import type { ProviderConfigOptions } from '@/lib/api';

export interface CreateConfigDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;

  /** 当前选中的 provider 类型 ('openai' / 'anthropic' / 'gemini') */
  provider: string;
  configName: string;
  baseUrl: string;
  apiKeys: string[];
  model: string;
  modelSupport: string[];
  modelEffort: string;
  maxConcurrency: number;
  /** 仅 Anthropic：最大输出 Token */
  maxTokens: string;
  /** 仅 OpenAI 系列：用量统计模式 */
  usageStatsMode: string;
  /** 仅 OpenAI 系列：请求方式（Anthropic 不存在） */
  requestMethod: string;
  /** 仅 OpenAI 系列：远端 Web Search off/on */
  remoteWebSearch: string;
  /** 仅 OpenAI 系列：思考回传 auto/off */
  sendBackThinking: string;
  /** 仅 OpenAI 系列：终端用户标识透传 off/hashed/raw */
  forwardEndUserId: string;
  /** 仅 OpenAI 系列：`hashed` 模式的盐值 */
  endUserIdSalt: string;
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
  onChangeModelEffort: (v: string) => void;
  onChangeModelSupport: (v: string[]) => void;
  onChangeMaxConcurrency: (v: number) => void;
  /** 仅 Anthropic：切到 anthropic 时被实际调用 */
  onChangeMaxTokens: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeUsageStatsMode: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeRequestMethod: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeRemoteWebSearch: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeSendBackThinking: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeForwardEndUserId: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeEndUserIdSalt: (v: string) => void;
  onReset: () => void;
  onSubmit: () => void;
}

/**
 * 「新建配置文件」Dialog。
 *
 * provider 切换 OpenAI / Anthropic / Gemini 时，后端并不下发的字段会自动隐藏：
 *  - `embedding_model`：后端不下发，整体移除
 *  - `max_tokens`：仅 Anthropic 等 provider 暴露
 *  - `usage_stats_mode` / `request_method`：仅 OpenAI 系列暴露（Gemini 也没有）
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
    maxConcurrency,
    maxTokens,
    usageStatsMode,
    requestMethod,
    remoteWebSearch,
    sendBackThinking,
    forwardEndUserId,
    endUserIdSalt,
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
    onChangeMaxConcurrency,
    onChangeMaxTokens,
    onChangeUsageStatsMode,
    onChangeRequestMethod,
    onChangeRemoteWebSearch,
    onChangeSendBackThinking,
    onChangeForwardEndUserId,
    onChangeEndUserIdSalt,
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
  const isAnthropic = provider === 'anthropic';
  const isGemini = provider === 'gemini';
  const isOpenAISeries = !isAnthropic && !isGemini;

  const options = providerConfigOptions?.options;
  const modelEffortOptions =
    options?.model_effort && options.model_effort.length > 0
      ? options.model_effort
      : ['enable', 'disable', 'minimal', 'low', 'medium', 'high', 'xhigh'];
  const maxConcurrencyOptions =
    options?.max_concurrency && options.max_concurrency.length > 0
      ? options.max_concurrency
      : [1, 2, 3, 4, 5, 6, 8, 10];
  const maxTokensOptions =
    options?.max_tokens && options.max_tokens.length > 0
      ? options.max_tokens
      : ['4096', '8192', '16384', '32768'];
  const usageStatsModeOptions =
    options?.usage_stats_mode && options.usage_stats_mode.length > 0
      ? options.usage_stats_mode
      : ['auto', 'incremental', 'cumulative'];
  const requestMethodOptions =
    options?.request_method && options.request_method.length > 0
      ? options.request_method
      : ['chat_completions', 'responses'];
  const remoteWebSearchOptions =
    options?.remote_web_search && options.remote_web_search.length > 0
      ? options.remote_web_search
      : ['off', 'on'];
  const sendBackThinkingOptions =
    options?.send_back_thinking && options.send_back_thinking.length > 0
      ? options.send_back_thinking
      : ['auto', 'off'];
  const forwardEndUserIdOptions =
    options?.forward_end_user_id && options.forward_end_user_id.length > 0
      ? options.forward_end_user_id
      : ['off', 'hashed', 'raw'];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onReset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t('aiConfig.openaiConfig.createNew')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('aiConfig.openaiConfig.createConfigAriaDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="font-semibold">{t('aiConfig.providerConfig.provider')}</Label>
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
                <ProviderBrandIcon provider="openai" size={16} className="text-current" />
                OpenAI 兼容格式
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
                <ProviderBrandIcon provider="anthropic" size={16} className="text-current" />
                Anthropic 格式
              </Button>
              <Button
                type="button"
                variant={provider === 'gemini' ? 'default' : 'outline'}
                size="sm"
                className="flex-1 gap-2"
                onClick={() => {
                  onChangeProvider('gemini');
                  onFetchProviderConfigOptions('gemini');
                }}
              >
                <ProviderBrandIcon provider="gemini" size={16} className="text-current" />
                Gemini 格式
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-semibold" htmlFor="configName">
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
            <Label className="font-semibold">{t('aiConfig.serviceProvider.apiBaseUrl')}</Label>
            <InputWithDropdown
              value={baseUrl}
              onChange={onChangeBaseUrl}
              options={options?.base_url || []}
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
            <Label className="font-semibold flex items-center gap-2">
              <Key className="w-4 h-4" />
              {t('aiConfig.serviceProvider.apiKey')}
              {options?.api_key && options.api_key.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {t('aiConfig.serviceProvider.apiKeyHint', {
                    prefixes: options.api_key.join(', '),
                  })}
                </span>
              )}
            </Label>
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
            <Label className="font-semibold flex items-center gap-2">
              <Server className="w-4 h-4" />
              {t('aiConfig.serviceProvider.apiModel')}
            </Label>
            <ModelSelectDropdown
              value={model}
              onChange={onChangeModel}
              presetOptions={options?.model_name || []}
              discoveredModels={fetchedModels}
              isFetching={isFetching}
              placeholder="选择或输入模型名称"
              inputPlaceholder="gpt-4o-mini"
            />
          </div>
          {/* max_tokens：仅 Anthropic 等 provider 暴露 */}
          {isAnthropic && (
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4" />
                {t('aiConfig.serviceProvider.maxTokens')}
              </Label>
              <InputWithDropdown
                value={maxTokens}
                onChange={onChangeMaxTokens}
                options={maxTokensOptions}
                placeholder={t('aiConfig.serviceProvider.maxTokens')}
                inputPlaceholder={t('aiConfig.serviceProvider.maxTokens')}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="font-semibold flex items-center gap-2">
              <span className="w-4 h-4 inline-flex items-center justify-center text-xs font-semibold">
                ✦
              </span>
              {t('aiConfig.serviceProvider.modelCapabilities')}
            </Label>
            <ChipGroup
              options={capabilities}
              value={modelSupport}
              onValueChange={onChangeModelSupport}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              {t('aiConfig.serviceProvider.modelEffort')}
            </Label>
            <InputWithDropdown
              value={modelEffort}
              onChange={onChangeModelEffort}
              options={modelEffortOptions}
              formatLabel={(raw) => getModelEffortLabel(t, raw)}
              placeholder={t('aiConfig.serviceProvider.modelEffort')}
              inputPlaceholder={t('aiConfig.serviceProvider.modelEffort')}
            />
          </div>
          <div className="space-y-2">
            <Label className="font-semibold flex items-center gap-2">
              <Hash className="w-4 h-4" />
              {t('aiConfig.serviceProvider.maxConcurrency')}
            </Label>
            <InputWithDropdown
              value={maxConcurrency}
              onChange={(val) => {
                const parsed = parseInt(val, 10);
                onChangeMaxConcurrency(Number.isNaN(parsed) ? 1 : parsed);
              }}
              options={maxConcurrencyOptions}
              placeholder={t('aiConfig.serviceProvider.maxConcurrency')}
              inputPlaceholder={t('aiConfig.serviceProvider.maxConcurrency')}
            />
          </div>
          {isAnthropic && (
            <div className="space-y-2">
              <Label className="font-semibold flex items-center gap-2">
                <Search className="w-4 h-4" />
                {t('aiConfig.serviceProvider.remoteWebSearch')}
              </Label>
              <InputWithDropdown
                value={remoteWebSearch}
                onChange={onChangeRemoteWebSearch}
                options={remoteWebSearchOptions}
                formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
              />
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{getRemoteWebSearchDescription(t, remoteWebSearch)}</span>
              </p>
            </div>
          )}
          {/* 仅 OpenAI 系列才有 usage_stats_mode / request_method */}
          {isOpenAISeries && (
            <>
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.usageStatsMode')}
                </Label>
                <InputWithDropdown
                  value={usageStatsMode}
                  onChange={onChangeUsageStatsMode}
                  options={usageStatsModeOptions}
                  formatLabel={(raw) => getUsageStatsModeLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.usageStatsMode')}
                  inputPlaceholder={t('aiConfig.serviceProvider.usageStatsMode')}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <Plug2 className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.requestMethod')}
                </Label>
                <InputWithDropdown
                  value={requestMethod}
                  onChange={onChangeRequestMethod}
                  options={requestMethodOptions}
                  formatLabel={(raw) => getRequestMethodLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.requestMethod')}
                  inputPlaceholder={t('aiConfig.serviceProvider.requestMethod')}
                />
                {requestMethod && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {getRequestMethodDescription(t, requestMethod)}
                    </span>
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.remoteWebSearch')}
                </Label>
                <InputWithDropdown
                  value={remoteWebSearch}
                  onChange={onChangeRemoteWebSearch}
                  options={remoteWebSearchOptions}
                  formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                  inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{getRemoteWebSearchDescription(t, remoteWebSearch)}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.sendBackThinking')}
                </Label>
                <InputWithDropdown
                  value={sendBackThinking}
                  onChange={onChangeSendBackThinking}
                  options={sendBackThinkingOptions}
                  formatLabel={(raw) => getSendBackThinkingLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.sendBackThinking')}
                  inputPlaceholder={t('aiConfig.serviceProvider.sendBackThinking')}
                />
              </div>
              <div className="space-y-2">
                <Label className="font-semibold flex items-center gap-2">
                  <Fingerprint className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.forwardEndUserId')}
                </Label>
                <InputWithDropdown
                  value={forwardEndUserId}
                  onChange={onChangeForwardEndUserId}
                  options={forwardEndUserIdOptions}
                  formatLabel={(raw) => getForwardEndUserIdLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                  inputPlaceholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{getForwardEndUserIdDescription(t, forwardEndUserId)}</span>
                </p>
              </div>
              {/* 盐值只在 hashed 模式下有意义，其余模式整块隐藏 */}
              {forwardEndUserId === 'hashed' && (
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.endUserIdSalt')}
                  </Label>
                  <ConfigField
                    fieldKey="end_user_id_salt"
                    field={{
                      type: 'password',
                      label: 'end_user_id_salt',
                      value: endUserIdSalt,
                      placeholder: t('aiConfig.serviceProvider.endUserIdSaltPlaceholder'),
                      description: '',
                    }}
                    showLabel={false}
                    onChange={(_k, v) => onChangeEndUserIdSalt(v as string)}
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{t('aiConfig.serviceProvider.endUserIdSaltHint')}</span>
                  </p>
                </div>
              )}
            </>
          )}
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
