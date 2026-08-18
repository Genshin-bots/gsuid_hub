import {
  AlertTriangle,
  Cpu,
  Fingerprint,
  Gauge,
  Globe,
  Hash,
  Info,
  Key,
  KeyRound,
  Loader2,
  Plug2,
  Search,
  Settings,
  Sparkles,
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
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { ModelSelectDropdown } from '@/components/ui/model-select-dropdown';
import { Label } from '@/components/ui/label';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
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
import type { OpenAIConfigData, ProviderConfigOptions } from '@/lib/api';

export interface EditConfigDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  configName: string;
  /**
   * 当前正在编辑的配置所属的 provider（`openai` / `anthropic` / `gemini` 等）。
   * 用来决定渲染哪些 provider-specific 字段：
   *  - `anthropic` → 展示 `max_tokens`，隐藏 `usage_stats_mode` / `request_method`
   *  - `gemini` → 两组都隐藏（只有公共字段）
   *  - 其它（OpenAI 系列）→ 展示 `usage_stats_mode` / `request_method`
   */
  editingConfigProvider: string;
  data: OpenAIConfigData | null;
  isLoading: boolean;
  isSaving: boolean;
  providerConfigOptions: ProviderConfigOptions | null;
  fetchedModels: string[];
  isFetching: boolean;
  baseUrlHasTrailingSlash: (url: string) => boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * 更新单个字段。`max_concurrency` 走 number、`max_tokens / usage_stats_mode`
   * 走 string、`model_support / api_key` 走 string[]。签名放宽到 unknown
   * 以同时容纳以上三类。
   */
  onChangeField: (field: keyof OpenAIConfigData, value: unknown) => void;
  onChangeModelEffort: (val: string) => void;
  onSave: () => void;
}

/**
 * 「编辑 OpenAI / Anthropic 配置文件」Dialog。
 *
 * `embedding_model` 后端并不下发，已移除；`max_tokens` 仅 Anthropic 暴露；
 * `usage_stats_mode` / `request_method` 仅 OpenAI 系列暴露。
 */
export function EditConfigDialog({
  open,
  t,
  configName,
  editingConfigProvider,
  data,
  isLoading,
  isSaving,
  providerConfigOptions,
  fetchedModels,
  isFetching,
  baseUrlHasTrailingSlash,
  onOpenChange,
  onChangeField,
  onChangeModelEffort,
  onSave,
}: EditConfigDialogProps) {
  const capabilities = getModelCapabilities(t);
  const options = providerConfigOptions?.options;
  const showBaseUrlWarning = data ? baseUrlHasTrailingSlash(data.base_url) : false;
  const isAnthropic = editingConfigProvider === 'anthropic';
  const isGemini = editingConfigProvider === 'gemini';
  const isOpenAISeries = !isAnthropic && !isGemini;

  // `model_effort` 选项优先取后端返回,缺省时回落到固定的 7 档兜底
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
  // 老后端不下发该字段，缺省按 off（不透传）渲染，与后端默认一致
  const forwardEndUserId = data?.forward_end_user_id || 'off';

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
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('aiConfig.serviceProvider.apiBaseUrl')}
              </Label>
              <InputWithDropdown
                value={data.base_url}
                onChange={(val) => onChangeField('base_url', val)}
                options={options?.base_url || []}
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
              <Label className="text-sm font-semibold flex items-center gap-2">
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
                  value: data.api_key || [],
                  placeholder: '输入API密钥（支持多个）',
                  description: '',
                }}
                showLabel={false}
                onChange={(_k, v) => onChangeField('api_key', v as string[])}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                {t('aiConfig.serviceProvider.apiModel')}
              </Label>
              <ModelSelectDropdown
                value={data.model_name}
                onChange={(val) => onChangeField('model_name', val)}
                presetOptions={options?.model_name || []}
                discoveredModels={fetchedModels}
                isFetching={isFetching}
                placeholder="选择或输入模型名称"
                inputPlaceholder="输入或选择模型名称"
              />
            </div>
            {/* max_tokens：仅 Anthropic 等 provider 暴露。 */}
            {isAnthropic && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.maxTokens')}
                </Label>
                <InputWithDropdown
                  value={data.max_tokens || ''}
                  onChange={(val) => onChangeField('max_tokens', val)}
                  options={maxTokensOptions}
                  placeholder={t('aiConfig.serviceProvider.maxTokens')}
                  inputPlaceholder={t('aiConfig.serviceProvider.maxTokens')}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                {t('aiConfig.serviceProvider.modelCapabilities')}
              </Label>
              <ChipGroup
                options={capabilities}
                value={Array.isArray(data.model_support) ? data.model_support : ['text']}
                onValueChange={(v) => onChangeField('model_support', v)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Gauge className="w-4 h-4" />
                {t('aiConfig.serviceProvider.modelEffort')}
              </Label>
              <InputWithDropdown
                value={data.model_effort || 'enable'}
                onChange={(val) => onChangeModelEffort(val)}
                options={modelEffortOptions}
                formatLabel={(raw) => getModelEffortLabel(t, raw)}
                placeholder={t('aiConfig.serviceProvider.modelEffort')}
                inputPlaceholder={t('aiConfig.serviceProvider.modelEffort')}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Hash className="w-4 h-4" />
                {t('aiConfig.serviceProvider.maxConcurrency')}
              </Label>
              <InputWithDropdown
                value={
                  typeof data.max_concurrency === 'number'
                    ? data.max_concurrency
                    : ''
                }
                onChange={(val) => {
                  // InputWithDropdown 只产出 string；保存前转换为 number，
                  // 空值回落到 1，避免 NaN 落库。
                  const parsed = parseInt(val, 10);
                  onChangeField('max_concurrency', Number.isNaN(parsed) ? 1 : parsed);
                }}
                options={maxConcurrencyOptions}
                placeholder={t('aiConfig.serviceProvider.maxConcurrency')}
                inputPlaceholder={t('aiConfig.serviceProvider.maxConcurrency')}
              />
            </div>
            {isAnthropic && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  {t('aiConfig.serviceProvider.remoteWebSearch')}
                </Label>
                <InputWithDropdown
                  value={data.remote_web_search || 'on'}
                  onChange={(val) => onChangeField('remote_web_search', val)}
                  options={remoteWebSearchOptions}
                  formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                  inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                />
                <p className="text-xs text-muted-foreground flex items-start gap-1">
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    {getRemoteWebSearchDescription(t, data.remote_web_search || 'on')}
                  </span>
                </p>
              </div>
            )}
            {/* OpenAI 系列才有 `usage_stats_mode` / `request_method` */}
            {isOpenAISeries && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.usageStatsMode')}
                  </Label>
                  <InputWithDropdown
                    value={data.usage_stats_mode || 'auto'}
                    onChange={(val) => onChangeField('usage_stats_mode', val)}
                    options={usageStatsModeOptions}
                    formatLabel={(raw) => getUsageStatsModeLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.usageStatsMode')}
                    inputPlaceholder={t('aiConfig.serviceProvider.usageStatsMode')}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Plug2 className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.requestMethod')}
                  </Label>
                  <InputWithDropdown
                    value={data.request_method || 'chat_completions'}
                    onChange={(val) => onChangeField('request_method', val)}
                    options={requestMethodOptions}
                    formatLabel={(raw) => getRequestMethodLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.requestMethod')}
                    inputPlaceholder={t('aiConfig.serviceProvider.requestMethod')}
                  />
                  {data.request_method && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1">
                      <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>
                        {getRequestMethodDescription(t, data.request_method)}
                      </span>
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.remoteWebSearch')}
                  </Label>
                  <InputWithDropdown
                    value={data.remote_web_search || 'on'}
                    onChange={(val) => onChangeField('remote_web_search', val)}
                    options={remoteWebSearchOptions}
                    formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                    inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {getRemoteWebSearchDescription(t, data.remote_web_search || 'on')}
                    </span>
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.sendBackThinking')}
                  </Label>
                  <InputWithDropdown
                    value={data.send_back_thinking || 'auto'}
                    onChange={(val) => onChangeField('send_back_thinking', val)}
                    options={sendBackThinkingOptions}
                    formatLabel={(raw) => getSendBackThinkingLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.sendBackThinking')}
                    inputPlaceholder={t('aiConfig.serviceProvider.sendBackThinking')}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Fingerprint className="w-4 h-4" />
                    {t('aiConfig.serviceProvider.forwardEndUserId')}
                  </Label>
                  <InputWithDropdown
                    value={forwardEndUserId}
                    onChange={(val) => onChangeField('forward_end_user_id', val)}
                    options={forwardEndUserIdOptions}
                    formatLabel={(raw) => getForwardEndUserIdLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                    inputPlaceholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                  />
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>
                      {getForwardEndUserIdDescription(t, forwardEndUserId)}
                    </span>
                  </p>
                </div>
                {/* 盐值只在 hashed 模式下有意义，其余模式整块隐藏 */}
                {forwardEndUserId === 'hashed' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2">
                      <KeyRound className="w-4 h-4" />
                      {t('aiConfig.serviceProvider.endUserIdSalt')}
                    </Label>
                    <ConfigField
                      fieldKey="end_user_id_salt"
                      field={{
                        type: 'password',
                        label: 'end_user_id_salt',
                        value: data.end_user_id_salt || '',
                        placeholder: t('aiConfig.serviceProvider.endUserIdSaltPlaceholder'),
                        description: '',
                      }}
                      showLabel={false}
                      onChange={(_k, v) => onChangeField('end_user_id_salt', v as string)}
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
