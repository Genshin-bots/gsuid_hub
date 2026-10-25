import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  Cpu,
  Film,
  Fingerprint,
  Gauge,
  Hash,
  Key,
  KeyRound,
  Network,
  Plus,
  Plug2,
  Search,
  Server,
  Sparkles,
  TrendingUp,
  Video,
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
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { ModelSelectDropdown } from '@/components/ui/model-select-dropdown';
import { Label } from '@/components/ui/label';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { ProviderBrandIcon } from '@/components/ui/model-brand-icon';
import { useLanguage } from '@/contexts/LanguageContext';
import { passthroughRender } from '../shared/PassthroughOption';
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
  getVideoInputFormatLabel,
  getVideoInputFormatDescription,
  getVideoUrlPassthroughLabel,
  getVideoUrlPassthroughDescription,
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
  /** 仅 OpenAI 系列：视频输入格式 file/video_url */
  videoInputFormat: string;
  /** 仅 OpenAI 系列：视频采样帧率 */
  videoFps: number;
  /** 仅 OpenAI 系列：视频块额外参数 (JSON) */
  videoPartExtra: string;
  /** 仅 OpenAI 系列：视频内联大小上限 (MB) */
  videoInlineMaxMb: number;
  /** 仅 OpenAI 系列：视频公网 URL 直通 off/on */
  videoUrlPassthrough: string;

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
  /** 仅 OpenAI 系列 */
  onChangeVideoInputFormat: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeVideoFps: (v: number) => void;
  /** 仅 OpenAI 系列 */
  onChangeVideoPartExtra: (v: string) => void;
  /** 仅 OpenAI 系列 */
  onChangeVideoInlineMaxMb: (v: number) => void;
  /** 仅 OpenAI 系列 */
  onChangeVideoUrlPassthrough: (v: string) => void;

  onReset: () => void;
  onSubmit: () => void;
}

/**
 * 「新建配置文件」Dialog。
 *
 * provider 切换 OpenAI / Anthropic / Gemini 时，后端并不下发的字段会自动隐藏：
 *  - `embedding_model`：后端不下发，整体移除
 *  - `max_tokens`：仅 Anthropic 等 provider 暴露
 *  - `usage_stats_mode` / `request_method` / `send_back_thinking` / `forward_end_user_id`：仅 OpenAI 系列暴露
 *  - `video_*`：仅 OpenAI 系列且启用「视频分析」能力时暴露
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
    videoInputFormat,
    videoFps,
    videoPartExtra,
    videoInlineMaxMb,
    videoUrlPassthrough,
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
    onChangeVideoInputFormat,
    onChangeVideoFps,
    onChangeVideoPartExtra,
    onChangeVideoInlineMaxMb,
    onChangeVideoUrlPassthrough,
    onReset,
    onSubmit,
  } = props;

  const [configName, setConfigName] = useState(props.configName);
  useEffect(() => {
    setConfigName(props.configName);
  }, [props.configName]);
  const { language } = useLanguage();
  const showRaw = language !== 'en-US';

  const capabilities = getModelCapabilities(t);
  const showBaseUrlWarning = baseUrlHasTrailingSlash(baseUrl);
  const isAnthropic = provider === 'anthropic';
  const isGemini = provider === 'gemini';
  const isOpenAISeries = !isAnthropic && !isGemini;
  const hasVideoCapability = modelSupport.includes('video');

  const options = providerConfigOptions?.options;
  const modelEffortOptions =
    options?.model_effort && options.model_effort.length > 0
      ? options.model_effort
      : ['adaptive', 'enable', 'disable', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
  const maxConcurrencyOptions =
    options?.max_concurrency && options.max_concurrency.length > 0
      ? options.max_concurrency
      : [1, 2, 3, 4, 5, 6, 8, 10, 11, 12];
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
  const rawVideoInputFormatOptions =
    options?.video_input_format && options.video_input_format.length > 0
      ? options.video_input_format
      : ['video_url', 'file'];
  const videoInputFormatOptions = rawVideoInputFormatOptions.includes('video_url')
    ? ['video_url', ...rawVideoInputFormatOptions.filter((o) => o !== 'video_url')]
    : rawVideoInputFormatOptions;
  const videoUrlPassthroughOptions =
    options?.video_url_passthrough && options.video_url_passthrough.length > 0
      ? options.video_url_passthrough
      : ['off', 'on'];
  const videoFpsOptions =
    options?.video_fps && options.video_fps.length > 0 ? options.video_fps : [0, 0.5, 1, 2, 4];
  const videoInlineMaxMbOptions =
    options?.video_inline_max_mb && options.video_inline_max_mb.length > 0
      ? options.video_inline_max_mb
      : [6, 12, 20, 50, 100];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onReset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[760px] md:max-w-[820px] max-h-[88vh] flex flex-col p-6 glass-card">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Plus className="w-5 h-5 text-primary" />
            {t('aiConfig.openaiConfig.createNew')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t('aiConfig.openaiConfig.createConfigAriaDesc')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto pr-2 py-3 space-y-6">
          <div className="space-y-5">
            {/* Provider 切换 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {t('aiConfig.providerConfig.provider')}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={provider === 'openai' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 h-9 text-xs justify-center"
                  onClick={() => {
                    onChangeProvider('openai');
                    onFetchProviderConfigOptions('openai');
                  }}
                >
                  <ProviderBrandIcon provider="openai" size={15} className="shrink-0" />
                  <span className="truncate">OpenAI 兼容</span>
                </Button>
                <Button
                  type="button"
                  variant={provider === 'anthropic' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 h-9 text-xs justify-center"
                  onClick={() => {
                    onChangeProvider('anthropic');
                    onFetchProviderConfigOptions('anthropic');
                  }}
                >
                  <ProviderBrandIcon provider="anthropic" size={15} className="shrink-0" />
                  <span className="truncate">Anthropic</span>
                </Button>
                <Button
                  type="button"
                  variant={provider === 'gemini' ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2 h-9 text-xs justify-center"
                  onClick={() => {
                    onChangeProvider('gemini');
                    onFetchProviderConfigOptions('gemini');
                  }}
                >
                  <ProviderBrandIcon provider="gemini" size={15} className="shrink-0" />
                  <span className="truncate">Gemini</span>
                </Button>
              </div>
            </div>

            {/* 配置名称 */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground" htmlFor="configName">
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
                className="h-9 text-sm"
              />
            </div>

            {/* API Base URL */}
            <div className="space-y-1.5">
              <LabelWithHelp
                icon={<Server className="w-3.5 h-3.5" />}
                label={t('aiConfig.serviceProvider.apiBaseUrl')}
                description="指定 API 的基础端点 URL。OpenAI 兼容端点通常以 /v1 结尾，请确保无多余末尾斜杠。"
              />
              <InputWithDropdown
                value={baseUrl}
                onChange={onChangeBaseUrl}
                options={options?.base_url || []}
                placeholder="选择或输入 API Base URL"
                inputPlaceholder="https://api.openai.com/v1"
                className={
                  showBaseUrlWarning ? 'border-red-500 text-red-600 dark:text-red-400' : undefined
                }
              />
              {showBaseUrlWarning && (
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1 mt-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {t('aiConfig.openaiConfig.baseUrlTrailingSlashWarning')}
                </p>
              )}
            </div>

            {/* API 密钥 */}
            <div className="space-y-1.5">
              <LabelWithHelp
                icon={<Key className="w-3.5 h-3.5" />}
                label={t('aiConfig.serviceProvider.apiKey')}
                description={
                  options?.api_key && options.api_key.length > 0
                    ? `输入调用凭证。支持配置多个密钥以均衡调用。${t('aiConfig.serviceProvider.apiKeyHint', { prefixes: options.api_key.join(', ') })}`
                    : '输入调用凭据，按回车添加多个密钥，支持多 Key 轮换与负载。'
                }
              />
              <ConfigField
                fieldKey="api_key"
                field={{
                  type: 'tags',
                  label: 'api_key',
                  value: apiKeys,
                  placeholder: '输入 API 密钥（回车添加，支持多个）',
                  description: '',
                }}
                showLabel={false}
                onChange={(_k, v) => onChangeApiKeys(v as string[])}
              />
            </div>

            {/* 调用模型名称 */}
            <div className="space-y-1.5">
              <LabelWithHelp
                icon={<Cpu className="w-3.5 h-3.5" />}
                label={t('aiConfig.serviceProvider.apiModel')}
                description="指定调用模型的标识符。支持从厂商预设列表选择，也可从上游端点在线探测可用模型。"
              />
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
          </div>

          {/* 模型与推理 */}
          <div className="pt-6 border-t border-border/40 space-y-5">
            {/* 模型支持能力 */}
            <div className="space-y-1.5">
              <LabelWithHelp
                icon={<Sparkles className="w-3.5 h-3.5" />}
                label={t('aiConfig.serviceProvider.modelCapabilities')}
                description="显式声明当前模型具备的模态处理能力（看图、语音、视频等）。启用视频分析后可在下方进一步配置全模态视频输入参数。"
              />
              <ChipGroup
                options={capabilities}
                value={modelSupport}
                onValueChange={onChangeModelSupport}
              />
            </div>

            {/* OpenAI 系列：请求方式 + 思考等级 并排 */}
            {isOpenAISeries ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Plug2 className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.requestMethod')}
                      description={
                        requestMethod ? getRequestMethodDescription(t, requestMethod) : undefined
                      }
                    />
                    <InputWithDropdown
                      value={requestMethod}
                      onChange={onChangeRequestMethod}
                      options={requestMethodOptions}
                      formatLabel={(raw) => getRequestMethodLabel(t, raw)}
                      placeholder={t('aiConfig.serviceProvider.requestMethod')}
                      inputPlaceholder={t('aiConfig.serviceProvider.requestMethod')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Gauge className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.modelEffort')}
                      description="模型的思考/推理深度档位。adaptive 不传参数由模型自行决定；enable/disable 显式控制；minimal~max 发送指定深度。"
                    />
                    <InputWithDropdown
                      value={modelEffort}
                      onChange={onChangeModelEffort}
                      options={modelEffortOptions}
                      formatLabel={(raw) => getModelEffortLabel(t, raw)}
                      renderOption={passthroughRender(showRaw, (raw) =>
                        getModelEffortLabel(t, raw),
                      )}
                      placeholder={t('aiConfig.serviceProvider.modelEffort')}
                      inputPlaceholder={t('aiConfig.serviceProvider.modelEffort')}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <LabelWithHelp
                    icon={<Hash className="w-3.5 h-3.5" />}
                    label={t('aiConfig.serviceProvider.maxConcurrency')}
                    description="单个配置允许同时进行的 LLM 请求数(1~12)。并发占满后新请求自动切换至备用(2nd)配置，实现负载均衡。"
                  />
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
              </>
            ) : (
              /* Anthropic / Gemini 系列 */
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Gauge className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.modelEffort')}
                      description="模型的思考/推理深度档位。adaptive 不传参数由模型自行决定；enable/disable 显式控制；minimal~max 发送指定深度。"
                    />
                    <InputWithDropdown
                      value={modelEffort}
                      onChange={onChangeModelEffort}
                      options={modelEffortOptions}
                      formatLabel={(raw) => getModelEffortLabel(t, raw)}
                      renderOption={passthroughRender(showRaw, (raw) =>
                        getModelEffortLabel(t, raw),
                      )}
                      placeholder={t('aiConfig.serviceProvider.modelEffort')}
                      inputPlaceholder={t('aiConfig.serviceProvider.modelEffort')}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.maxConcurrency')}
                      description="单个配置允许同时进行的 LLM 请求数(1~12)。并发占满后新请求自动切换至备用(2nd)配置，实现负载均衡。"
                    />
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
                </div>

                {/* 仅 Anthropic：max_tokens */}
                {isAnthropic && (
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Hash className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.maxTokens')}
                      description="Anthropic Messages API 单次响应的最大 Token 数限制。"
                    />
                    <InputWithDropdown
                      value={maxTokens}
                      onChange={onChangeMaxTokens}
                      options={maxTokensOptions}
                      placeholder={t('aiConfig.serviceProvider.maxTokens')}
                      inputPlaceholder={t('aiConfig.serviceProvider.maxTokens')}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 全模态视频输入（仅 OpenAI 系列 且 勾选「视频分析」时才展示） */}
          {isOpenAISeries && hasVideoCapability && (
            <div className="pt-6 border-t border-border/40 space-y-5">
              <div className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-md px-3 py-2 leading-relaxed">
                {t('aiConfig.serviceProvider.sectionVideoAlert')}
              </div>

              {/* 视频输入格式 */}
              <div className="space-y-1.5">
                <LabelWithHelp
                  icon={<Film className="w-3.5 h-3.5" />}
                  label={t('aiConfig.serviceProvider.videoInputFormat')}
                  description={getVideoInputFormatDescription(t, videoInputFormat || 'video_url')}
                />
                <InputWithDropdown
                  value={videoInputFormat || 'video_url'}
                  onChange={onChangeVideoInputFormat}
                  options={videoInputFormatOptions}
                  formatLabel={(raw) => getVideoInputFormatLabel(t, raw)}
                  placeholder={t('aiConfig.serviceProvider.videoInputFormat')}
                  inputPlaceholder={t('aiConfig.serviceProvider.videoInputFormat')}
                />
              </div>

              {/* 当选择 video_url 时展开全模态视频参数 */}
              {videoInputFormat === 'video_url' ? (
                <div className="space-y-5 pt-2 border-t border-border/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    {/* 采样帧率 */}
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<Gauge className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.videoFps')}
                        description={t('aiConfig.serviceProvider.videoFpsDescription')}
                      />
                      <InputWithDropdown
                        value={videoFps}
                        onChange={(val) => {
                          const parsed = parseFloat(val);
                          onChangeVideoFps(Number.isNaN(parsed) ? 0 : parsed);
                        }}
                        options={videoFpsOptions}
                        placeholder={t('aiConfig.serviceProvider.videoFps')}
                        inputPlaceholder="0 或 2.0"
                      />
                    </div>

                    {/* 内联大小上限 */}
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<Hash className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.videoInlineMaxMb')}
                        description={t('aiConfig.serviceProvider.videoInlineMaxMbDescription')}
                      />
                      <InputWithDropdown
                        value={videoInlineMaxMb}
                        onChange={(val) => {
                          const parsed = parseInt(val, 10);
                          onChangeVideoInlineMaxMb(Number.isNaN(parsed) ? 12 : parsed);
                        }}
                        options={videoInlineMaxMbOptions}
                        placeholder={t('aiConfig.serviceProvider.videoInlineMaxMb')}
                        inputPlaceholder="12"
                      />
                    </div>
                  </div>

                  {/* 公网 URL 直通 */}
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Network className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.videoUrlPassthrough')}
                      description={getVideoUrlPassthroughDescription(
                        t,
                        videoUrlPassthrough || 'off',
                      )}
                    />
                    <InputWithDropdown
                      value={videoUrlPassthrough}
                      onChange={onChangeVideoUrlPassthrough}
                      options={videoUrlPassthroughOptions}
                      formatLabel={(raw) => getVideoUrlPassthroughLabel(t, raw)}
                      placeholder={t('aiConfig.serviceProvider.videoUrlPassthrough')}
                      inputPlaceholder={t('aiConfig.serviceProvider.videoUrlPassthrough')}
                    />
                  </div>

                  {/* 视频块额外参数 (JSON) */}
                  <div className="space-y-1.5">
                    <LabelWithHelp
                      icon={<Plug2 className="w-3.5 h-3.5" />}
                      label={t('aiConfig.serviceProvider.videoPartExtra')}
                      description={t('aiConfig.serviceProvider.videoPartExtraDescription')}
                    />
                    <Input
                      value={videoPartExtra}
                      onChange={(e) => onChangeVideoPartExtra(e.target.value)}
                      placeholder={t('aiConfig.serviceProvider.videoPartExtraPlaceholder')}
                      className="font-mono text-xs h-9"
                    />
                  </div>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/80 italic px-1">
                  {t('aiConfig.serviceProvider.videoFileModeHint')}
                </div>
              )}
            </div>
          )}

          {/* 协议与高级网络 */}
          {(isAnthropic || isOpenAISeries) && (
            <div className="pt-6 border-t border-border/40 space-y-5">
              {/* 仅 Anthropic：remote_web_search */}
              {isAnthropic && (
                <div className="space-y-1.5">
                  <LabelWithHelp
                    icon={<Search className="w-3.5 h-3.5" />}
                    label={t('aiConfig.serviceProvider.remoteWebSearch')}
                    description={getRemoteWebSearchDescription(t, remoteWebSearch || 'on')}
                  />
                  <InputWithDropdown
                    value={remoteWebSearch}
                    onChange={onChangeRemoteWebSearch}
                    options={remoteWebSearchOptions}
                    formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                    placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                    inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                  />
                </div>
              )}

              {/* OpenAI 系列：流式 Usage + 远端搜索、思考回传 + 用户标识透传 */}
              {isOpenAISeries && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<TrendingUp className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.usageStatsMode')}
                        description="流式响应中 usage 的解析模式：incremental（仅最后 chunk）或 cumulative（累计，如 SiliconFlow/vLLM）。auto 为自动探测。"
                      />
                      <InputWithDropdown
                        value={usageStatsMode}
                        onChange={onChangeUsageStatsMode}
                        options={usageStatsModeOptions}
                        formatLabel={(raw) => getUsageStatsModeLabel(t, raw)}
                        placeholder={t('aiConfig.serviceProvider.usageStatsMode')}
                        inputPlaceholder={t('aiConfig.serviceProvider.usageStatsMode')}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<Search className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.remoteWebSearch')}
                        description={getRemoteWebSearchDescription(t, remoteWebSearch || 'on')}
                      />
                      <InputWithDropdown
                        value={remoteWebSearch}
                        onChange={onChangeRemoteWebSearch}
                        options={remoteWebSearchOptions}
                        formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                        placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                        inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<Brain className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.sendBackThinking')}
                        description="多轮对话中是否将历史上下文中的思考过程重新回发给模型。遇网关报错可置为 off。"
                      />
                      <InputWithDropdown
                        value={sendBackThinking}
                        onChange={onChangeSendBackThinking}
                        options={sendBackThinkingOptions}
                        formatLabel={(raw) => getSendBackThinkingLabel(t, raw)}
                        placeholder={t('aiConfig.serviceProvider.sendBackThinking')}
                        inputPlaceholder={t('aiConfig.serviceProvider.sendBackThinking')}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <LabelWithHelp
                        icon={<Fingerprint className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.forwardEndUserId')}
                        description={getForwardEndUserIdDescription(t, forwardEndUserId)}
                      />
                      <InputWithDropdown
                        value={forwardEndUserId}
                        onChange={onChangeForwardEndUserId}
                        options={forwardEndUserIdOptions}
                        formatLabel={(raw) => getForwardEndUserIdLabel(t, raw)}
                        placeholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                        inputPlaceholder={t('aiConfig.serviceProvider.forwardEndUserId')}
                      />
                    </div>
                  </div>

                  {forwardEndUserId === 'hashed' && (
                    <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/20 p-3">
                      <LabelWithHelp
                        icon={<KeyRound className="w-3.5 h-3.5" />}
                        label={t('aiConfig.serviceProvider.endUserIdSalt')}
                        description={t('aiConfig.serviceProvider.endUserIdSaltHint')}
                      />
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
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 pt-3 border-t border-border/40 gap-2">
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
