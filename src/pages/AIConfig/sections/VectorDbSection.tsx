import { useState, useRef, useEffect } from 'react';
import {
  ArrowUpDown,
  Cpu,
  Database,
  Globe,
  HelpCircle,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { ChipGroup } from '@/components/ui/MultiSelectChipGroup';
import { DynamicConfigPanel, ConfigField, type ConfigFieldType, type ConfigValue } from '@/components/config';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { cn } from '@/lib/utils';
import { renderRichText } from '../shared/renderRichText';
import type { PluginConfigItem } from '@/lib/api';
import type { EmbeddingConfigField } from '../constants';
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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Database className="w-5 h-5 text-primary" />
          {t('aiConfig.vectorDb.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.vectorDb.description')}
        </p>
      </div>

      {/* 1. Qdrant 部署方式 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-primary" />
          <Label className="text-sm font-semibold">
            {t('aiConfig.vectorDb.qdrantProvider')}
          </Label>
        </div>
        <p className="text-xs text-muted-foreground">
          {qdrantProviderDesc || t('aiConfig.vectorDb.qdrantProviderDesc')}
        </p>
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
          options={(availableProviders || embeddingProviderOptions).map((p) => ({
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
          ) : embeddingProvider === 'local' ? (
            <div className="space-y-3">
              {Object.entries(embeddingLocalConfig).map(([key, field]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    {field.title || key}
                  </Label>
                  {field.desc && (
                    <p className="text-xs text-muted-foreground">{field.desc}</p>
                  )}
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
              {Object.entries(embeddingOpenaiConfig).map(([key, field]) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    {key === 'base_url' && <Globe className="w-3.5 h-3.5" />}
                    {key === 'api_key' && <HelpCircle className="w-3.5 h-3.5" />}
                    {key === 'embedding_model' && <Cpu className="w-3.5 h-3.5" />}
                    {field.title || key}
                  </Label>
                  {field.desc && (
                    <p className="text-xs text-muted-foreground">{field.desc}</p>
                  )}
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
