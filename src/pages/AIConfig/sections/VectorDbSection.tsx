import { useState, useRef, useEffect, type ReactNode } from 'react';
import {
  ArrowUpDown,
  Cpu,
  Database,
  Globe,
  Key,
  Search,
  Server,
  AlertTriangle,
  Sparkles,
  Cog,
  SlidersHorizontal,
} from 'lucide-react';
import { GlassAlert } from '@/components/ui/glass-alert';
import { pageGapClass, pageStackClass } from '@/components/layout/PinnedPage';
import { cn } from '@/lib/utils';

import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  DynamicConfigPanel,
  ConfigField,
  type ConfigFieldType,
  type ConfigValue,
} from '@/components/config';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { renderRichText } from '../shared/renderRichText';
import {
  ConfigCard,
  ConfigGroup,
  fieldGrid2Class,
  fieldWide2Class,
  LabelWithHelp,
} from '../shared';
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
  t: (key: string, params?: Record<string, string | number>) => string;
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
  useEffect(() => {
    initialQdrantRef.current = qdrantProvider;
  }, []);
  useEffect(() => {
    initialEmbeddingRef.current = embeddingProvider;
  }, []);

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

  // URL / API Key 等长内容字段占满整行，其余按 3 列栅格排布
  const isWideField = (key: string) => {
    const lower = key.toLowerCase();
    return lower === 'api_key' || lower.includes('url') || lower.includes('host');
  };

  return (
    <div className={pageStackClass}>
      {/*
        xl 双列：左列 Qdrant + Rerank（均较短），右列 Embedding（长卡片）。
        半宽卡内字段面板用 columns={2} / fieldGrid2Class。
      */}
      <div className={cn('grid items-start xl:grid-cols-2 glass-card-grid', pageGapClass)}>
        <div className={pageStackClass}>
          {/* 1. Qdrant 部署方式 */}
          <ConfigCard
            icon={<Server className="w-5 h-5 text-primary" />}
            title={t('aiConfig.vectorDb.qdrantProvider')}
            description={qdrantProviderDesc || t('aiConfig.vectorDb.qdrantProviderDesc')}
          >
            <TabButtonGroup
              size="sm"
              value={qdrantProvider || ''}
              onValueChange={(v) => handleQdrantProviderChange([v])}
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
            />
            {qdrantChanged && (
              <GlassAlert tone="warning" icon={AlertTriangle} contentClassName="text-xs">
                {renderRichText(t('aiConfig.vectorDb.switchWarning'))}
              </GlassAlert>
            )}
            {qdrantProvider !== 'remote' && (
              <p className="text-xs text-muted-foreground">
                {t('aiConfig.vectorDb.qdrantRecommendTip')}{' '}
                <a
                  href="https://github.com/qdrant/qdrant/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  GitHub Releases
                </a>
                {' · '}
                <a
                  href="https://cloud.qdrant.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 hover:text-foreground transition-colors"
                >
                  Qdrant Cloud
                </a>
              </p>
            )}
            {qdrantProvider === 'remote' && qdrantConfig && (
              <div className="border-t border-border/40 pt-4">
                <DynamicConfigPanel
                  config={qdrantConfig.config}
                  configId={qdrantConfig.id}
                  onChange={onUpdateConfig}
                  columns={2}
                />
              </div>
            )}
          </ConfigCard>

          {/* 3. 重排序模型 */}
          <ConfigCard
            icon={<ArrowUpDown className="w-5 h-5 text-primary" />}
            title={t('aiConfig.serviceProvider.rerankService')}
            actions={
              <Switch
                checked={isRerankEnabled}
                onCheckedChange={(checked) => onUpdateConfig(aiConfigId, 'enable_rerank', checked)}
              />
            }
          >
            {isRerankEnabled && (
              <>
                <GlassAlert tone="warning" icon={AlertTriangle} contentClassName="text-xs">
                  {t('aiConfig.vectorDb.rerankWarning')}
                </GlassAlert>
                {(() => {
                  const opts = rerankProviderOptions.map((p) => ({
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
                  }));
                  return opts.length <= 4 ? (
                    <TabButtonGroup
                      size="sm"
                      value={rerankProvider || ''}
                      onValueChange={(v) => onUpdateConfig(aiConfigId, 'rerank_provider', v)}
                      options={opts}
                    />
                  ) : (
                    <ChipGroup
                      options={opts}
                      value={rerankProvider ? [rerankProvider] : []}
                      onValueChange={(newValue) =>
                        onUpdateConfig(aiConfigId, 'rerank_provider', newValue[0] || '')
                      }
                      selectMode="single"
                      showRadioIndicator
                    />
                  );
                })()}
                {rerankConfig && (
                  <div className="border-t border-border/40 pt-4">
                    <DynamicConfigPanel
                      config={rerankConfig.config}
                      configId={rerankConfig.id}
                      onChange={onUpdateConfig}
                      excludeKeys={rerankProvider === 'openai' ? [] : ['base_url', 'api_key']}
                      columns={2}
                    />
                  </div>
                )}
              </>
            )}
          </ConfigCard>
        </div>

        {/* 2. 嵌入模型提供方 */}
        <ConfigCard
          icon={<Cpu className="w-5 h-5 text-primary" />}
          title={t('aiConfig.serviceProvider.embeddingService')}
        >
          {(() => {
            const opts = (availableProviders || embeddingProviderOptions).map((p) => {
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
                icon: extra ? (
                  <Globe className="w-3.5 h-3.5" />
                ) : p === 'local' ? (
                  <Database className="w-3.5 h-3.5" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                ),
              };
            });
            return opts.length <= 4 ? (
              <TabButtonGroup
                size="sm"
                value={embeddingProvider || ''}
                onValueChange={(v) => handleEmbeddingProviderChange([v])}
                options={opts}
              />
            ) : (
              <ChipGroup
                options={opts}
                value={embeddingProvider ? [embeddingProvider] : []}
                onValueChange={handleEmbeddingProviderChange}
                selectMode="single"
                showRadioIndicator
              />
            );
          })()}
          {embeddingChanged && (
            <GlassAlert tone="warning" icon={AlertTriangle} contentClassName="text-xs">
              {renderRichText(t('aiConfig.vectorDb.switchWarning'))}
            </GlassAlert>
          )}
          <div className="border-t border-border/40 pt-4">
            {isLoadingEmbeddingConfig ? (
              <div className="flex items-center justify-center py-6">
                <span className="text-xs text-muted-foreground">...</span>
              </div>
            ) : currentExtraProvider ? (
              /* 插件注册的第三方 provider：只读展示 */
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  {renderRichText(
                    t('aiConfig.vectorDb.extraProviderBanner', {
                      displayName: currentExtraProvider.display_name,
                      plugin: currentExtraProvider.plugin,
                      kind: currentExtraProvider.kind,
                    }),
                  )}{' '}
                  {t('aiConfig.vectorDb.extraProviderHint')}
                </p>
                <div className={fieldGrid2Class}>
                  {Object.entries(currentExtraProvider.config || {}).map(([key, field]) => (
                    <div
                      key={key}
                      className={cn('space-y-1.5', isWideField(key) && fieldWide2Class)}
                    >
                      <FieldLabel
                        icon={getProviderFieldIcon(key)}
                        title={field.title || key}
                        desc={field.desc}
                      />
                      <p className="text-sm text-muted-foreground">
                        {formatExtraProviderFieldData(field.data, t)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : embeddingProvider === 'local' ? (
              <div className={fieldGrid2Class}>
                {Object.entries(embeddingLocalConfig)
                  // 「嵌入模型支持的模态」是 framework-config 的全局字段，
                  // 会在本节末尾用 ChipGroup 渲染，这里跳过避免重复。
                  .filter(([key]) => key !== 'embedding_modalities')
                  .map(([key, field]) => (
                    <div
                      key={key}
                      className={cn('space-y-1.5', isWideField(key) && fieldWide2Class)}
                    >
                      <FieldLabel
                        icon={getProviderFieldIcon(key)}
                        title={field.title || key}
                        desc={field.desc}
                      />
                      <ConfigField
                        fieldKey={key}
                        field={{
                          type: (Array.isArray(field.options) && field.options.length > 0
                            ? 'select'
                            : 'text') as ConfigFieldType,
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
              <div className={fieldGrid2Class}>
                {Object.entries(embeddingOpenaiConfig)
                  // 「嵌入模型支持的模态」是 framework-config 的全局字段，
                  // 会在本节末尾用 ChipGroup 渲染，这里跳过避免重复 + 错误的单值下拉。
                  .filter(([key]) => key !== 'embedding_modalities')
                  .map(([key, field]) => (
                    <div
                      key={key}
                      className={cn('space-y-1.5', isWideField(key) && fieldWide2Class)}
                    >
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
                            placeholder: t('aiConfig.vectorDb.apiKeyPlaceholder'),
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
                          placeholder={t('aiConfig.vectorDb.selectOrInput', {
                            name: field.title || key,
                          })}
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
          {embeddingConfig?.config.embedding_modalities &&
            (() => {
              const item = embeddingConfig.config.embedding_modalities;
              const value = Array.isArray(item.value) ? (item.value as string[]) : [];
              return (
                <ConfigGroup
                  icon={<Sparkles className="w-4 h-4 text-muted-foreground" />}
                  label={item.title || t('aiConfig.vectorDb.embeddingModalities')}
                  description={item.desc}
                >
                  <ChipGroup
                    options={getEmbeddingModalities(t)}
                    value={value}
                    onValueChange={(v) =>
                      onUpdateConfig(embeddingConfig.id, 'embedding_modalities', v)
                    }
                  />
                </ConfigGroup>
              );
            })()}
        </ConfigCard>
      </div>

      {/* Qdrant 部署方式切换确认弹窗 */}
      <AlertDialog open={isQdrantSwitchDialogOpen} onOpenChange={setIsQdrantSwitchDialogOpen}>
        <AlertDialogContent className="max-w-[500px] glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('aiConfig.vectorDb.switchWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <GlassAlert tone="warning" icon={AlertTriangle}>
                <span>{renderRichText(t('aiConfig.vectorDb.switchWarning'))}</span>
              </GlassAlert>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsQdrantSwitchDialogOpen(false)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmQdrantSwitch}>
              {t('aiConfig.vectorDb.switchConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 嵌入模型提供方切换确认弹窗 */}
      <AlertDialog open={isEmbeddingSwitchDialogOpen} onOpenChange={setIsEmbeddingSwitchDialogOpen}>
        <AlertDialogContent className="max-w-[500px] glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              {t('aiConfig.vectorDb.switchWarningTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <GlassAlert tone="warning" icon={AlertTriangle}>
                <span>{renderRichText(t('aiConfig.vectorDb.switchWarning'))}</span>
              </GlassAlert>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsEmbeddingSwitchDialogOpen(false)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEmbeddingSwitch}>
              {t('aiConfig.vectorDb.switchConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 格式化第三方 provider 配置字段的只读展示值 */
function formatExtraProviderFieldData(
  data: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (data == null) return '—';
  if (Array.isArray(data)) {
    if (data.length === 0) return t('aiConfig.vectorDb.emptyValue');
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
function FieldLabel({ icon, title, desc }: { icon: ReactNode; title: string; desc?: string }) {
  return (
    <LabelWithHelp
      icon={<span className="text-muted-foreground/80">{icon}</span>}
      label={title}
      description={desc}
      className="text-xs font-normal text-muted-foreground gap-1.5"
    />
  );
}
