/**
 * CommandExecutorSection
 *
 * 「AI 配置」页内子菜单中的「命令执行器」配置 section。
 *
 * 数据来源：
 *   GET /api/framework-config/GsCore AI 命令执行器配置
 *   （由 `useFrameworkConfig` 自动按 prefix=GsCore AI 拉取，落地到 `configs`）
 *
 * 字段分组（按后端 gsdivider 顺序）：
 *   - 身份与授权
 *   - 审批策略
 *   - 网络与下载
 *   - 执行限制
 *   - 审计
 *
 * 保存流与其它 section 一致：父级 AIConfigPage 的 `executeSave` 会在
 * 检测到该 config 变化时调用 `frameworkConfigApi.updateFrameworkConfig`
 * 提交，因此本 section 不需要自带保存按钮。
 *
 * 布局约定：与 AdvancedSettingsSection / MemeSettingsSection 一致——
 * 标题 + 描述 + 总开关 + 3 列 grid（divider 占整行），不做 Card 包裹。
 */
import { AlertTriangle, ShieldAlert, Terminal } from 'lucide-react';
import {
  ConfigField,
  pluginConfigItemToFieldDef,
  type ConfigFieldType,
  type ConfigValue,
} from '@/components/config';
import { Switch } from '@/components/ui/switch';
import type { PluginConfigItem } from '@/lib/api';

export interface CommandExecutorSectionProps {
  t: (key: string) => string;
  /**
   * 「命令执行器」配置。后端返回的 id 为 `GsCore AI 命令执行器配置`，
   * 由父级从 `configs` 中按名称匹配后传入；找不到时本 section 不渲染。
   */
  commandExecutorConfig?: {
    id: string;
    config: Record<string, PluginConfigItem>;
  };
  /** 字段值变更回调（沿用 main save 流） */
  onUpdateConfig: (configId: string, fieldKey: string, value: ConfigValue) => void;
}

/** 不放入 3 列 grid 统一渲染的字段（顶部总开关） */
const TOP_LEVEL_KEYS: string[] = ['enable'];

/**
 * 「审批模式」选项的中文友好标签映射。后端返回的值为字符串选项（all/smart/auto），
 * 直接渲染不利于用户理解；这里仅在选项字符串与本地化 key 不一致时回退原值。
 */
const APPROVAL_MODE_LABEL_KEYS: Record<string, string> = {
  all: 'aiConfig.commandExecutor.approvalMode.all',
  smart: 'aiConfig.commandExecutor.approvalMode.smart',
  auto: 'aiConfig.commandExecutor.approvalMode.auto',
};

const PATH_ARG_POLICY_LABEL_KEYS: Record<string, string> = {
  approval: 'aiConfig.commandExecutor.pathArgPolicy.approval',
  deny: 'aiConfig.commandExecutor.pathArgPolicy.deny',
  off: 'aiConfig.commandExecutor.pathArgPolicy.off',
};

export function CommandExecutorSection({
  t,
  commandExecutorConfig,
  onUpdateConfig,
}: CommandExecutorSectionProps) {
  if (!commandExecutorConfig) {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
            <Terminal className="w-5 h-5 text-muted-foreground" />
            {t('aiConfig.commandExecutor.title')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t('aiConfig.commandExecutor.notFound')}
          </p>
        </div>
      </div>
    );
  }

  const { id: configId, config } = commandExecutorConfig;

  // 总开关
  const enableValue = (config.enable?.value as boolean) ?? false;

  // 网络放行相关（用于安全提示）
  const allowNetwork = (config.allow_network?.value as boolean) ?? false;
  const allowAutoProvision =
    (config.allow_auto_provision?.value as boolean) ?? false;

  // 关闭时不渲染子配置，但保留 3 列 grid 的占位提示
  const entries = Object.entries(config).filter(
    ([key]) => !TOP_LEVEL_KEYS.includes(key),
  );

  return (
    <div className="space-y-5">
      {/* 标题区 */}
      <div>
        <h2 className="text-lg font-bold flex items-center gap-2 mb-1">
          <Terminal className="w-5 h-5 text-primary" />
          {t('aiConfig.commandExecutor.title')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t('aiConfig.commandExecutor.description')}
        </p>
      </div>

      {/* 总开关（行内：图标 + 标题 + 描述 + Switch），与 MemeSettingsSection 同款 */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg border border-border/30 bg-card/30">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 text-primary shrink-0">
            <Terminal className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">
              {t('aiConfig.commandExecutor.configCard.enableLabel')}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {config.enable?.desc
                ? String(config.enable.desc)
                : t('aiConfig.commandExecutor.enableDesc')}
            </p>
          </div>
        </div>
        <Switch
          checked={enableValue}
          onCheckedChange={(checked) =>
            onUpdateConfig(configId, 'enable', checked)
          }
        />
      </div>

      {/* 高危提示：开启 + 联网 / 自动安装 时显示 */}
      {enableValue && (allowNetwork || allowAutoProvision) && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/40 bg-red-500/5 p-4 text-sm">
          <ShieldAlert className="w-4 h-4 mt-0.5 text-red-600 dark:text-red-400 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold">
              {t('aiConfig.commandExecutor.dangerTitle')}
            </p>
            <p className="text-muted-foreground">
              {t('aiConfig.commandExecutor.dangerDesc')}
            </p>
          </div>
        </div>
      )}

      {/* 关闭态：占位提示 */}
      {!enableValue && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 rounded-lg border border-border/30 bg-muted/20">
          <AlertTriangle className="w-4 h-4" />
          <span>{t('aiConfig.commandExecutor.disabledHint')}</span>
        </div>
      )}

      {/* 3 列 grid：divider 占整行，其它字段占一格 */}
      {enableValue && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([key, item]) => {
            let fieldDef = pluginConfigItemToFieldDef(key, item);

            // 「审批模式」/「参数路径越界策略」是 enum，原始 ConfigField 会把 options
            // 渲染为 select，但 label 是英文 key。这里把 label 映射成 i18n 友好文案。
            if (key === 'approval_mode') {
              const rawOptions = (item.options || []) as string[];
              fieldDef = {
                ...fieldDef,
                options: rawOptions.map(
                  (opt) =>
                    APPROVAL_MODE_LABEL_KEYS[opt]
                      ? t(APPROVAL_MODE_LABEL_KEYS[opt])
                      : opt,
                ),
              };
            } else if (key === 'path_arg_policy') {
              const rawOptions = (item.options || []) as string[];
              fieldDef = {
                ...fieldDef,
                options: rawOptions.map(
                  (opt) =>
                    PATH_ARG_POLICY_LABEL_KEYS[opt]
                      ? t(PATH_ARG_POLICY_LABEL_KEYS[opt])
                      : opt,
                ),
              };
            }

            const isDivider = fieldDef.type === ('divider' as ConfigFieldType);
            return (
              <div
                key={key}
                className={isDivider ? 'col-span-full' : undefined}
              >
                <ConfigField
                  fieldKey={key}
                  field={fieldDef}
                  onChange={(fieldKey, value) =>
                    onUpdateConfig(configId, fieldKey, value)
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('aiConfig.commandExecutor.footnote')}
      </p>
    </div>
  );
}