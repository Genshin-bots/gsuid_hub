import {
  AlertTriangle,
  Brain,
  Cpu,
  Film,
  Fingerprint,
  Gauge,
  Globe,
  Hash,
  Key,
  KeyRound,
  Loader2,
  Network,
  Plug2,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Video,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
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
import { LabelWithHelp } from '@/components/ui/label-with-help';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
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
import type { OpenAIConfigData, ProviderConfigOptions } from '@/lib/api';

export interface EditConfigDialogProps {
  open: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  configName: string;
  /**
   * 当前正在编辑的配置所属的 provider（`openai` / `anthropic` / `gemini` 等）。
   * 用来决定渲染哪些 provider-specific 字段：
   *  - `anthropic` → 展示 `max_tokens`，隐藏 `usage_stats_mode` / `request_method` / `video_*`
   *  - `gemini` → 隐藏 provider-specific 字段（只有公共字段）
   *  - 其它（OpenAI 系列）→ 展示完整 OpenAI 字段与视频全模态字段
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
   * 以同时容纳所有类型。
   */
  onChangeField: (field: keyof OpenAIConfigData, value: unknown) => void;
  onChangeModelEffort: (val: string) => void;
  onSave: () => void;
}

/**
 * 「编辑配置文件」Dialog。
 *
 * provider 切换 OpenAI / Anthropic / Gemini 时，后端并不下发的字段会自动隐藏：
 *  - `embedding_model`：后端不下发，整体移除
 *  - `max_tokens`：仅 Anthropic 等 provider 暴露
 *  - `usage_stats_mode` / `request_method` / `send_back_thinking` / `forward_end_user_id`：仅 OpenAI 系列暴露
 *  - `video_*`：仅 OpenAI 系列且启用「视频分析」能力时暴露
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
  const { language } = useLanguage();
  const showRaw = language !== 'en-US';
  const capabilities = getModelCapabilities(t);
  const options = providerConfigOptions?.options;
  const showBaseUrlWarning = data ? baseUrlHasTrailingSlash(data.base_url) : false;
  const isAnthropic = editingConfigProvider === 'anthropic';
  const isGemini = editingConfigProvider === 'gemini';
  const isOpenAISeries = !isAnthropic && !isGemini;
  const hasVideoCapability =
    Array.isArray(data?.model_support) && data.model_support.includes('video');

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

  const forwardEndUserId = data?.forward_end_user_id || 'off';
  const videoInputFormat = data?.video_input_format || 'video_url';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[760px] md:max-w-[820px] max-h-[88vh] flex flex-col p-6 glass-card">
        <DialogHeader className="shrink-0 pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Settings className="w-5 h-5 text-primary" />
            {t('aiConfig.openaiConfig.editConfigTitle')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground font-mono">
            {editingConfigProvider} ++ {configName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 py-3 space-y-6">
            <div className="space-y-5">
              {/* API Base URL */}
              <div className="space-y-1.5">
                <LabelWithHelp
                  icon={<Globe className="w-3.5 h-3.5" />}
                  label={t('aiConfig.serviceProvider.apiBaseUrl')}
                  description="指定 API 的基础端点 URL。OpenAI 兼容端点通常以 /v1 结尾，请确保无多余末尾斜杠。"
                />
                <InputWithDropdown
                  value={data.base_url}
                  onChange={(val) => onChangeField('base_url', val)}
                  options={options?.base_url || []}
                  placeholder="选择或输入 API Base URL"
                  inputPlaceholder="输入或选择 API Base URL"
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
                    value: data.api_key || [],
                    placeholder: '输入 API 密钥（回车添加，支持多个）',
                    description: '',
                  }}
                  showLabel={false}
                  onChange={(_k, v) => onChangeField('api_key', v as string[])}
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
                  value={data.model_name}
                  onChange={(val) => onChangeField('model_name', val)}
                  presetOptions={options?.model_name || []}
                  discoveredModels={fetchedModels}
                  isFetching={isFetching}
                  placeholder="选择或输入模型名称"
                  inputPlaceholder="输入或选择模型名称"
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
                  value={Array.isArray(data.model_support) ? data.model_support : ['text']}
                  onValueChange={(v) => onChangeField('model_support', v)}
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
                          data.request_method
                            ? getRequestMethodDescription(t, data.request_method)
                            : undefined
                        }
                      />
                      <InputWithDropdown
                        value={data.request_method || 'chat_completions'}
                        onChange={(val) => onChangeField('request_method', val)}
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
                        value={data.model_effort || 'enable'}
                        onChange={(val) => onChangeModelEffort(val)}
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
                      value={typeof data.max_concurrency === 'number' ? data.max_concurrency : ''}
                      onChange={(val) => {
                        const parsed = parseInt(val, 10);
                        onChangeField('max_concurrency', Number.isNaN(parsed) ? 1 : parsed);
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
                        value={data.model_effort || 'enable'}
                        onChange={(val) => onChangeModelEffort(val)}
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
                        value={typeof data.max_concurrency === 'number' ? data.max_concurrency : ''}
                        onChange={(val) => {
                          const parsed = parseInt(val, 10);
                          onChangeField('max_concurrency', Number.isNaN(parsed) ? 1 : parsed);
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
                        value={data.max_tokens || ''}
                        onChange={(val) => onChangeField('max_tokens', val)}
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
                    description={getVideoInputFormatDescription(t, videoInputFormat)}
                  />
                  <InputWithDropdown
                    value={videoInputFormat}
                    onChange={(val) => onChangeField('video_input_format', val)}
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
                          value={typeof data.video_fps === 'number' ? data.video_fps : 0}
                          onChange={(val) => {
                            const parsed = parseFloat(val);
                            onChangeField('video_fps', Number.isNaN(parsed) ? 0 : parsed);
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
                          value={
                            typeof data.video_inline_max_mb === 'number'
                              ? data.video_inline_max_mb
                              : 12
                          }
                          onChange={(val) => {
                            const parsed = parseInt(val, 10);
                            onChangeField(
                              'video_inline_max_mb',
                              Number.isNaN(parsed) ? 12 : parsed,
                            );
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
                          data.video_url_passthrough || 'off',
                        )}
                      />
                      <InputWithDropdown
                        value={data.video_url_passthrough || 'off'}
                        onChange={(val) => onChangeField('video_url_passthrough', val)}
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
                        value={data.video_part_extra || ''}
                        onChange={(e) => onChangeField('video_part_extra', e.target.value)}
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
                      description={getRemoteWebSearchDescription(t, data.remote_web_search || 'on')}
                    />
                    <InputWithDropdown
                      value={data.remote_web_search || 'on'}
                      onChange={(val) => onChangeField('remote_web_search', val)}
                      options={remoteWebSearchOptions}
                      formatLabel={(raw) => getRemoteWebSearchLabel(t, raw)}
                      placeholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                      inputPlaceholder={t('aiConfig.serviceProvider.remoteWebSearch')}
                    />
                  </div>
                )}

                {/* OpenAI 系列字段 */}
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
                          value={data.usage_stats_mode || 'auto'}
                          onChange={(val) => onChangeField('usage_stats_mode', val)}
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
                          description={getRemoteWebSearchDescription(
                            t,
                            data.remote_web_search || 'on',
                          )}
                        />
                        <InputWithDropdown
                          value={data.remote_web_search || 'on'}
                          onChange={(val) => onChangeField('remote_web_search', val)}
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
                          value={data.send_back_thinking || 'auto'}
                          onChange={(val) => onChangeField('send_back_thinking', val)}
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
                          onChange={(val) => onChangeField('forward_end_user_id', val)}
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
                            value: data.end_user_id_salt || '',
                            placeholder: t('aiConfig.serviceProvider.endUserIdSaltPlaceholder'),
                            description: '',
                          }}
                          showLabel={false}
                          onChange={(_k, v) => onChangeField('end_user_id_salt', v as string)}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-16">
            {t('aiConfig.openaiConfig.noConfig')}
          </div>
        )}

        <DialogFooter className="shrink-0 pt-3 border-t border-border/40 gap-2">
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
