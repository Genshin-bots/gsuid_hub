import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  ArrowUpDown,
  Cpu,
  Database,
  Globe,
  HelpCircle,
  Key,
  Search,
  Server,
  AlertTriangle,
  Sparkles,
  Cog,
  SlidersHorizontal,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, ConfigField, type ConfigFieldType, type ConfigValue } from '@/components/config';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { cn } from '@/lib/utils';
import { renderRichText } from '../shared/renderRichText';
import { LabelWithHelp } from '../shared';
import type { EmbeddingExtraProviderConfig, PluginConfigItem } from '@/lib/api';
import { type EmbeddingConfigField, getEmbeddingModalities } from '../constants.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface VectorDbSectionProps {
  t: (key: string) => string;
  isGlass: boolean;
  aiConfigId: string;

  // Qdrant
  qdrantProvider: string;
  qdrantProviderOptions: string[];
  qdrantProviderDesc?: string;
  qdrantConfig?: { id: string; config: Record<string, PluginConfigItem> };

  // Embedding
  embeddingProvider: string;
  embeddingProviderOptions: string[];
  availableProviders?: string[];
  isLoadingEmbeddingConfig: boolean;
  embeddingLocalConfig: Record<string, EmbeddingConfigField>;
  embeddingOpenaiConfig: Record<string, EmbeddingConfigField>;
  /**
   * 来自 framework-config 的「OpenAI 嵌入模型配置」（id 通常为 "GsCore AI OpenAI嵌入模型配置"）。
   * 与 `embeddingOpenaiConfig` 来自不同 API：前者是 framework-config 接口，后者是
   * `/api/embedding_config/openai`；目前 `embedding_modalities` 等「能力/模态」字段
   * 只在 framework-config 中下发，因此这里需要单独接收。
   */
  embeddingConfig?: { id: string; config: Record<string, PluginConfigItem> };
  /** 插件注册的第三方嵌入模型提供方（key=provider 名） */
  extraProviders?: Record<string, EmbeddingExtraProviderConfig>;

  // Rerank
  isRerankEnabled: boolean;
  rerankProvider: string;
  rerankProviderOptions: string[];
  rerankConfig?: { id: string; config: Record<string, PluginConfigItem> };

  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
  onSwitchEmbeddingProvider: (provider: string) => void;
  onUpdateEmbeddingLocalField: (fieldKey: string, value: unknown) => void;
  onUpdateEmbeddingOpenaiField: (fieldKey: string, value: unknown) => void;
}

/**
 * 「向量数据库服务」Section。
 * 包含三大块：Qdrant 部署方式 / 嵌入模型提供方 / 重排序模型。
 *
 * 嵌入模型支持 local / openai 内置以及插件注册的第三方 provider。
 * 第三方 provider 的配置以前端只读方式展示，修改走插件管理页（`/api/plugins`）。
 *
 * 重排序的字段渲染使用 `DynamicConfigPanel`，但当 provider 为 local 时排除 base_url/api_key。
 */
export function VectorDbSection({
  t,
  isGlass,
  aiConfigId,
  qdrantProvider,
  qdrantProviderOptions,
  qdrantProviderDesc,
  qdrantConfig,
  embeddingProvider,
  embeddingProviderOptions,
  availableProviders,
  isLoadingEmbeddingConfig,
  embeddingLocalConfig,
  embeddingOpenaiConfig,
  embeddingConfig,
  extraProviders,
  isRerankEnabled,
  rerankProvider,
  rerankProviderOptions,
  rerankConfig,
  onUpdateConfig,
  onSwitchEmbeddingProvider,
  onUpdateEmbeddingLocalField,
  onUpdateEmbeddingOpenaiField,
}: VectorDbSectionProps) {
  // —— 记录初始值，用于判断是否真正发生了变更 ——
  const initialQdrantRef = useRef(qdrantProvider);
  const initialEmbeddingRef = useRef(embeddingProvider);
  useEffect(() => { initialQdrantRef.current = qdrantProvider; }, []);
  useEffect(() => { initialEmbeddingRef.current = embeddingProvider; }, []);

  // —— Qdrant 部署方式切换确认弹窗 ——
  const [isQdrantSwitchDialogOpen, setIsQdrantSwitchDialogOpen] = useState(false);
  const [pendingQdrantValue, setPendingQdrantValue] = useState('');
  const [qdrantChanged, setQdrantChanged] = useState(false);

  // —— 嵌入模型提供方切换确认弹窗 ——
  const [isEmbeddingSwitchDialogOpen, setIsEmbeddingSwitchDialogOpen] = useState(false);
  const [pendingEmbeddingValue, setPendingEmbeddingValue] = useState('');
  const [embeddingChanged, setEmbeddingChanged] = useState(false);

  const handleQdrantProviderChange = (newValue: string[]) => {
    const target = newValue[0] || '';
    if (target && target !== qdrantProvider) {
      // 切回原值：不弹窗，直接应用，隐藏警告
      if (target === initialQdrantRef.current) {
        setQdrantChanged(false);
        onUpdateConfig(aiConfigId, 'qdrant_provider', target);
      } else {
        // 切到新值：弹窗确认
        setPendingQdrantValue(target);
        setIsQdrantSwitchDialogOpen(true);
      }
    }
  };

  const handleConfirmQdrantSwitch = () => {
    setIsQdrantSwitchDialogOpen(false);
    setQdrantChanged(true);
    onUpdateConfig(aiConfigId, 'qdrant_provider', pendingQdrantValue);
  };

  const handleEmbeddingProviderChange = (newValue: string[]) => {
    const np = newValue[0] || '';
    if (np && np !== embeddingProvider) {
      // 切回原值：不弹窗，直接应用，隐藏警告
      if (np === initialEmbeddingRef.current) {
        setEmbeddingChanged(false);
        onUpdateConfig(aiConfigId, 'embedding_provider', np);
        onSwitchEmbeddingProvider(np);
      } else {
        // 切到新值：弹窗确认
        setPendingEmbeddingValue(np);
        setIsEmbeddingSwitchDialogOpen(true);
      }
    }
  };

  const handleConfirmEmbeddingSwitch = () => {
    setIsEmbeddingSwitchDialogOpen(false);
    setEmbeddingChanged(true);
    onUpdateConfig(aiConfigId, 'embedding_provider', pendingEmbeddingValue);
    onSwitchEmbeddingProvider(pendingEmbeddingValue);
  };

  // —— 嵌入模型当前是否为插件注册的第三方 provider ——
  const currentExtraProvider = extraProviders?.[embeddingProvider];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-primary" />
          {t('aiConfig.vectorDb.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.vectorDb.description')}
        </p>
      </div>

      {/* 1. Qdrant 部署方式 */}
      <div className="space-y-3">
        <LabelWithHelp
          icon={<Server className="w-4 h-4 text-primary" />}
          label={t('aiConfig.vectorDb.qdrantProvider')}
          description={qdrantProviderDesc || t('aiConfig.vectorDb.qdrantProviderDesc')}
        />
        <ChipGroup
          options={qdrantProviderOptions.map((p) => ({
            value: p,
            label:
              p === 'local'
                ? t('aiConfig.vectorDb.qdrantLocal')
                : p === 'remote'
                  ? t('aiConfig.vectorDb.qdrantRemote')
                  : p,
            icon:
              p === 'local' ? (
                <Database className="w-3.5 h-3.5" />
              ) : (
                <Globe className="w-3.5 h-3.5" />
              ),
          }))}
          value={qdrantProvider ? [qdrantProvider] : []}
          onValueChange={handleQdrantProviderChange}
          selectMode="single"
          showRadioIndicator
        />
        {qdrantChanged && (
          <div
            className={cn(
              'rounded-lg p-3 flex items-start gap-2',
              isGlass
                ? 'border border-amber-500/40 bg-amber-500/10'
                : 'border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40',
            )}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {renderRichText(t('aiConfig.vectorDb.switchWarning'))}
            </p>
          </div>
        )}
        {qdrantProvider !== 'remote' && (
          <div
            className={cn(
              'rounded-lg p-3 flex items-start gap-2',
              isGlass
                ? 'border border-blue-500/40 bg-blue-500/10'
                : 'border border-blue-200 bg-blue-50 dark:border-blue-800/60 dark:bg-blue-950/40',
            )}
          >
            <HelpCircle className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5">
              <p>{t('aiConfig.vectorDb.qdrantRecommendTip')}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://github.com/qdrant/qdrant/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                >
                  GitHub Releases
                </a>
                <span className="text-blue-400 dark:text-blue-600">·</span>
                <a
                  href="https://cloud.qdrant.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-blue-600 dark:hover:text-blue-300 transition-colors"
                >
                  Qdrant Cloud
                </a>
              </div>
            </div>
          </div>
        )}
        {qdrantProvider === 'remote' && qdrantConfig && (
          <div className="pt-3 border-t border-border/30">
            <DynamicConfigPanel
              config={qdrantConfig.config}
              configId={qdrantConfig.id}
              onChange={onUpdateConfig}
              layout={[['url'], ['api_key']]}
            />
          </div>
        )}
      </div>

      <Separator className="bg-border/30" />

      {/* 2. 嵌入模型提供方 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">
            {t('aiConfig.serviceProvider.embeddingService')}
          </Label>
        </div>
        <ChipGroup
          options={(availableProviders || embeddingProviderOptions).map((p) => {
            const extra = extraProviders?.[p];
            return {
              value: p,
              label: extra?.display_name
                ? extra.display_name
                : p === 'local'
                  ? t('aiConfig.serviceProvider.localModel')
                  : p === 'openai'
                    ? t('aiConfig.serviceProvider.openaiModel')
                    : p,
              icon: extra
                ? <Globe className="w-3.5 h-3.5" />
                : p === 'local'
                  ? <Database className="w-3.5 h-3.5" />
                  : <Globe className="w-3.5 h-3.5" />,
            };
          })}
          value={embeddingProvider ? [embeddingProvider] : []}
          onValueChange={handleEmbeddingProviderChange}
          selectMode="single"
          showRadioIndicator
        />
        {embeddingChanged && (
          <div
            className={cn(
              'rounded-lg p-3 flex items-start gap-2',
              isGlass
                ? 'border border-amber-500/40 bg-amber-500/10'
                : 'border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40',
            )}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {renderRichText(t('aiConfig.vectorDb.switchWarning'))}
            </p>
          </div>
        )}
        <div className="pt-3 border-t border-border/30">
          {isLoadingEmbeddingConfig ? (
            <div className="flex items-center justify-center py-6">
              <span className="text-xs text-muted-foreground">...</span>
            </div>
          ) : currentExtraProvider ? (
            /* 插件注册的第三方 provider：只读展示 */
            <div className="space-y-3">
              <div
                className={cn(
                  'rounded-lg p-3 flex items-start gap-2',
                  isGlass
                    ? 'border border-violet-500/40 bg-violet-500/10'
                    : 'border border-violet-300 bg-violet-50 dark:border-violet-800/60 dark:bg-violet-950/40',
                )}
              >
                <Globe className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
                <div className="text-xs text-violet-700 dark:text-violet-300 space-y-1">
                  <p className="font-semibold">
                    {renderRichText(
                      t('aiConfig.vectorDb.extraProviderBanner')
                        .replace('{displayName}', currentExtraProvider.display_name)
                        .replace('{plugin}', currentExtraProvider.plugin)
                        .replace('{kind}', currentExtraProvider.kind),
                    )}
                  </p>
                  <p className="text-violet-500 dark:text-violet-400">
                    {t('aiConfig.vectorDb.extraProviderHint')}
                  </p>
                </div>
              </div>
              {Object.entries(currentExtraProvider.config || {}).map(([key, field]) => (
                <div key={key} className="space-y-1.5">
                  <FieldLabel
                    icon={getProviderFieldIcon(key)}
                    title={field.title || key}
                    desc={field.desc}
                  />
                  <div className="text-sm px-3 py-2 rounded-md border border-dashed border-border/60 bg-muted/30 text-muted-foreground">
                    {formatExtraProviderFieldData(field.data)}
                  </div>
                </div>
              ))}
            </div>
          ) : embeddingProvider === 'local' ? (
            <div className="space-y-3">
              {Object.entries(embeddingLocalConfig)
                // 「嵌入模型支持的模态」是 framework-config 的全局字段，
                // 会在本节末尾用 ChipGroup 渲染，这里跳过避免重复。
                .filter(([key]) => key !== 'embedding_modalities')
                .map(([key, field]) => (
                <div key={key} className="space-y-1.5">
                  <FieldLabel
                    icon={getProviderFieldIcon(key)}
                    title={field.title || key}
                    desc={field.desc}
                  />
                  <ConfigField
                    fieldKey={key}
                    field={{
                      type: (
                        Array.isArray(field.options) && field.options.length > 0
                          ? 'select'
                          : 'text'
                      ) as ConfigFieldType,
                      label: field.title || key,
                      value: field.data == null ? '' : String(field.data),
                      options: (field.options || []).map((o) => String(o)),
                      placeholder: '',
                      description: field.desc || '',
                    }}
                    showLabel={false}
                    onChange={(k, v) => onUpdateEmbeddingLocalField(k, v)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {Object.entries(embeddingOpenaiConfig)
                // 「嵌入模型支持的模态」是 framework-config 的全局字段，
                // 会在本节末尾用 ChipGroup 渲染，这里跳过避免重复 + 错误的单值下拉。
                .filter(([key]) => key !== 'embedding_modalities')
                .map(([key, field]) => (
                <div key={key} className="space-y-1.5">
                  <FieldLabel
                    icon={getProviderFieldIcon(key)}
                    title={field.title || key}
                    desc={field.desc}
                  />
                  {key === 'api_key' ? (
                    <ConfigField
                      fieldKey={key}
                      field={{
                        type: 'tags',
                        label: field.title || key,
                        value: (field.data as string[]) || [],
                        placeholder: '输入API密钥（支持多个）',
                        description: field.desc || '',
                      }}
                      showLabel={false}
                      onChange={(k, v) => onUpdateEmbeddingOpenaiField(k, v)}
                    />
                  ) : (
                    <InputWithDropdown
                      value={field.data == null ? '' : String(field.data)}
                      onChange={(val) => onUpdateEmbeddingOpenaiField(key, val)}
                      options={(field.options || []).map((o) => String(o))}
                      placeholder={`选择或输入${field.title || key}`}
                      inputPlaceholder={
                        field.options?.[0] != null ? String(field.options[0]) : ''
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {/*
          「嵌入模型支持的模态」字段来自 framework-config（id="GsCore AI OpenAI嵌入模型配置"），
          是独立于 provider 的全局设置，因此放在所有 provider-specific 字段之后。
          切换 local / openai / 第三方 provider 都能看到并修改。
        */}
        {embeddingConfig?.config.embedding_modalities && (() => {
          const item = embeddingConfig.config.embedding_modalities;
          const value = Array.isArray(item.value)
            ? (item.value as string[])
            : [];
          return (
            <div className="space-y-1.5">
              <FieldLabel
                icon={<Sparkles className="w-3 h-3" />}
                title={item.title || t('aiConfig.vectorDb.embeddingModalities')}
                desc={item.desc}
              />
              <ChipGroup
                options={getEmbeddingModalities(t)}
                value={value}
                onValueChange={(v) =>
                  onUpdateConfig(embeddingConfig.id, 'embedding_modalities', v)
                }
              />
            </div>
          );
        })()}
      </div>

      <Separator className="bg-border/30" />

      {/* 3. 重排序模型 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-primary" />
            <Label className="text-sm font-semibold">
              {t('aiConfig.serviceProvider.rerankService')}
            </Label>
          </div>
          <Switch
            checked={isRerankEnabled}
            onCheckedChange={(checked) =>
              onUpdateConfig(aiConfigId, 'enable_rerank', checked)
            }
          />
        </div>
        <div
          className={cn(
            'rounded-lg p-3 flex items-start gap-2',
            isGlass
              ? 'border border-amber-500/40 bg-amber-500/10'
              : 'border border-amber-300 bg-amber-50 dark:border-amber-800/60 dark:bg-amber-950/40',
          )}
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {t('aiConfig.vectorDb.rerankWarning')}
          </p>
        </div>
        {isRerankEnabled && (
          <>
            <ChipGroup
              options={rerankProviderOptions.map((p) => ({
                value: p,
                label:
                  p === 'local'
                    ? t('aiConfig.serviceProvider.localModel')
                    : p === 'openai'
                      ? t('aiConfig.serviceProvider.openaiModel')
                      : p,
                icon:
                  p === 'local' ? (
                    <Database className="w-3.5 h-3.5" />
                  ) : (
                    <Globe className="w-3.5 h-3.5" />
                  ),
              }))}
              value={rerankProvider ? [rerankProvider] : []}
              onValueChange={(newValue) =>
                onUpdateConfig(aiConfigId, 'rerank_provider', newValue[0] || '')
              }
              selectMode="single"
              showRadioIndicator
            />
            {rerankConfig && (
              <div className="pt-3 border-t border-border/30">
                <DynamicConfigPanel
                  config={rerankConfig.config}
                  configId={rerankConfig.id}
                  onChange={onUpdateConfig}
                  excludeKeys={
                    rerankProvider === 'openai' ? [] : ['base_url', 'api_key']
                  }
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Qdrant 部署方式切换确认弹窗 */}
      <AlertDialog open={isQdrantSwitchDialogOpen} onOpenChange={setIsQdrantSwitchDialogOpen}>
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('aiConfig.vectorDb.switchWarningTitle') || '切换 Qdrant 部署方式'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed text-foreground/90 rounded-md bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{renderRichText(t('aiConfig.vectorDb.switchWarning'))}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsQdrantSwitchDialogOpen(false)}>
              {t('common.cancel') || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmQdrantSwitch}>
              {t('aiConfig.vectorDb.switchConfirm') || '我已了解，继续切换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 嵌入模型提供方切换确认弹窗 */}
      <AlertDialog open={isEmbeddingSwitchDialogOpen} onOpenChange={setIsEmbeddingSwitchDialogOpen}>
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('aiConfig.vectorDb.switchWarningTitle') || '切换嵌入模型提供方'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed text-foreground/90 rounded-md bg-amber-500/5 border border-amber-500/20 p-3 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{renderRichText(t('aiConfig.vectorDb.switchWarning'))}</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsEmbeddingSwitchDialogOpen(false)}>
              {t('common.cancel') || '取消'}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmbeddingSwitch}>
              {t('aiConfig.vectorDb.switchConfirm') || '我已了解，继续切换'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 格式化第三方 provider 配置字段的只读展示值 */
function formatExtraProviderFieldData(data: unknown): string {
  if (data == null) return '—';
  if (Array.isArray(data)) {
    if (data.length === 0) return '（空）';
    return data.map((v) => String(v)).join(', ');
  }
  if (typeof data === 'boolean') return data ? 'true' : 'false';
  const s = String(data);
  return s || '—';
}

/**
 * 根据字段 key 推断一个 lucide 小图标（w-3 h-3）。
 * 用于 local / openai / extra provider 三个分支的字段 label 前面。
 */
function getProviderFieldIcon(fieldKey: string) {
  const lower = fieldKey.toLowerCase();
  if (lower.includes('api_key') || lower.includes('apikey') || lower === 'key') {
    return <Key className="w-3 h-3" />;
  }
  if (lower.includes('base_url') || lower.includes('host') || lower.includes('url')) {
    return <Globe className="w-3 h-3" />;
  }
  if (lower.includes('model')) {
    return <Cpu className="w-3 h-3" />;
  }
  if (lower.includes('dimension') || lower.includes('dim')) {
    return <SlidersHorizontal className="w-3 h-3" />;
  }
  if (lower.includes('search') || lower.includes('type')) {
    return <Search className="w-3 h-3" />;
  }
  return <Cog className="w-3 h-3" />;
}

/**
 * 统一的字段标题：左侧 lucide 小图标 + 标题文字 + 右侧悬浮提示（带 desc 时显示 ? 按钮）。
 * 与 `DynamicConfigPanel` 的字段 label 风格保持一致。复用 `LabelWithHelp`，
 * 仅用 `className` 覆盖成更小、更暗的内嵌字段样式。
 */
function FieldLabel({
  icon,
  title,
  desc,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
}) {
  return (
    <LabelWithHelp
      icon={<span className="text-muted-foreground/80">{icon}</span>}
      label={title}
      description={desc}
      className="text-xs font-normal text-muted-foreground gap-1.5"
    />
  );
}
