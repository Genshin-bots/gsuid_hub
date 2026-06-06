import { AlertTriangle } from 'lucide-react';
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

export interface EmbeddingWarningDialogProps {
  open: boolean;
  t: (key: string) => string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 「修改嵌入模型 / Qdrant 部署方式」前的二次确认 Dialog。
 *
 * 该类操作会重建向量数据并要求服务重启，需在保存前显式确认。
 */
export function EmbeddingWarningDialog({
  open,
  t,
  onOpenChange,
  onConfirm,
}: EmbeddingWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            {t('aiConfig.serviceProvider.embeddingSaveWarningTitle') ||
              '修改嵌入模型配置警告'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('aiConfig.serviceProvider.embeddingSaveWarningDesc') ||
              '修改嵌入模型服务配置将导致大部分嵌入数据重构。建议先备份 data/ai_core 文件夹后再执行，配置保存后需要重启服务才能生效。'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('common.cancel') || '取消'}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            {t('common.confirm') || '确认保存'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
