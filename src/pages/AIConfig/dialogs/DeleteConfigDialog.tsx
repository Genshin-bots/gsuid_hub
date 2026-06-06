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

export interface DeleteConfigDialogProps {
  open: boolean;
  t: (key: string) => string;
  configName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/**
 * 「删除配置文件」确认 Dialog。
 */
export function DeleteConfigDialog({
  open,
  t,
  configName,
  onOpenChange,
  onConfirm,
}: DeleteConfigDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            {t('aiConfig.openaiConfig.deleteTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('aiConfig.openaiConfig.deleteMessage').replace('{name}', configName)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('common.delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
