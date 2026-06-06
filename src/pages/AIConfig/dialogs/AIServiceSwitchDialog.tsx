import { AlertTriangle, Power, PowerOff, Info } from 'lucide-react';
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
import { renderRichText } from '../shared/renderRichText';

export interface AIServiceSwitchDialogProps {
  /** 对话框打开状态 */
  open: boolean;
  /** 当前模式：开启 / 关闭 */
  mode: 'enable' | 'disable';
  /** 国际化 */
  t: (key: string) => string;
  onOpenChange: (open: boolean) => void;
  /** 用户点击确认（仅是关闭弹窗，不做实际启停） */
  onConfirm: () => void;
  /** 是否为"仅查看帮助"模式——隐藏确认按钮，只显示关闭按钮 */
  helpOnly?: boolean;
}

/** 每一行的展示类型 */
interface DialogLine {
  text: string;
  /** 'warn' = 警告样式（橙色背景 + AlertTriangle），'info' = 普通信息样式（蓝色背景 + Info） */
  variant: 'warn' | 'info';
}

/**
 * 「启用 / 关闭 AI 服务」前的提示 Dialog。
 *
 * - 启用：提示用户接受 Agent 不稳定行为、提示重启、提示 Token 消耗、提示 Web Search 必要等。
 * - 关闭：提示用户重启以彻底释放内存占用。
 * - helpOnly：从"使用帮助"按钮打开时，只显示关闭按钮。
 */
export function AIServiceSwitchDialog({
  open,
  mode,
  t,
  onOpenChange,
  onConfirm,
  helpOnly = false,
}: AIServiceSwitchDialogProps) {
  const isEnable = mode === 'enable';

  // —— 开启 AI 服务 ——
  const enableTitle =
    t('aiConfig.serviceSwitch.enableDialog.title') || '启用 AI 功能提示';
  const enableConfirm =
    t('aiConfig.serviceSwitch.enableDialog.confirm') || '我已了解，继续开启';
  const enableLines: DialogLine[] = [
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line1') ||
        '启用AI功能代表你接受Agent可能的不稳定行为。开启后请务必重启核心，系统将加载**大约200MB内存占用**的依赖。重启后请继续完成相关配置，你还需要**配置人格**才能使用AI功能。',
      variant: 'warn',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line2') ||
        '为了节省Token消耗，请不要将人格的范围扩展到全部群聊。',
      variant: 'info',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line3') ||
        '**记忆功能**中的**被动感知**将会消耗大量token，因为会在后台将全部消息纳入分析队列并生成相关记忆图谱。',
      variant: 'info',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line4') ||
        '请务必配置**网络搜索服务**，用于Agent的最新消息获取。',
      variant: 'warn',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line5') ||
        '**高级设置**中的黑名单白名单功能全局生效，优先于人格配置。',
      variant: 'info',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line7') ||
        '建议尽可能使用**远程 Qdrant 服务**以获得更好的性能和稳定性。您可以从 [GitHub Releases](https://github.com/qdrant/qdrant/releases) 下载 Qdrant 直接运行，也可以使用 [Qdrant Cloud](https://cloud.qdrant.io/) 托管服务。',
      variant: 'info',
    },
    {
      text:
        t('aiConfig.serviceSwitch.enableDialog.line6') ||
        '如想再次查看本提示，请点击右上角的**使用帮助**按钮重新浏览。',
      variant: 'info',
    },
  ];

  // —— 关闭 AI 服务 ——
  const disableTitle =
    t('aiConfig.serviceSwitch.disableDialog.title') || '关闭 AI 功能提示';
  const disableConfirm =
    t('aiConfig.serviceSwitch.disableDialog.confirm') || '我已了解，继续关闭';
  const disableLine =
    t('aiConfig.serviceSwitch.disableDialog.line1') ||
    '为了彻底关闭AI功能的占用，建议你立即重启核心以完成关闭。';

  const closeLabel = t('common.close') || '关闭';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[560px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {isEnable ? (
              <Power className="w-5 h-5 text-amber-500" />
            ) : (
              <PowerOff className="w-5 h-5 text-amber-500" />
            )}
            {isEnable ? enableTitle : disableTitle}
          </AlertDialogTitle>
          {isEnable ? (
            <AlertDialogDescription asChild>
              <div className="space-y-2.5 text-sm leading-relaxed text-foreground/90">
                {enableLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2 rounded-md border p-2.5 ${
                      line.variant === 'warn'
                        ? 'bg-amber-500/5 border-amber-500/20'
                        : 'bg-blue-500/5 border-blue-500/15'
                    }`}
                  >
                    {line.variant === 'warn' ? (
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                    ) : (
                      <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-500" />
                    )}
                    <span>{renderRichText(line.text)}</span>
                  </div>
                ))}
              </div>
            </AlertDialogDescription>
          ) : (
            <AlertDialogDescription asChild>
              <div className="text-sm leading-relaxed text-foreground/90 rounded-md bg-amber-500/5 border border-amber-500/20 p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
                <span>{disableLine}</span>
              </div>
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          {helpOnly ? (
            <AlertDialogAction onClick={() => onOpenChange(false)}>
              {closeLabel}
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel onClick={() => onOpenChange(false)}>
                {t('common.cancel') || '取消'}
              </AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm}>
                {isEnable ? enableConfirm : disableConfirm}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
