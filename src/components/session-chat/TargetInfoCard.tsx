/**
 * 群 / 用户信息卡。点头像或右键「查看群信息 / 查看用户信息」都开这个。
 *
 * 字段：群身份 / openid / 账号 / unionid；群聊则是群名 / 群号。
 */
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { assetUrl, ROLE_KEY, type TargetInfo } from '@/lib/sessionChat';

interface TargetInfoCardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  info: TargetInfo | null;
  loading?: boolean;
}

export function TargetInfoCard({ open, onOpenChange, info, loading }: TargetInfoCardProps) {
  const { t } = useLanguage();
  const rows: Array<{ label: string; value: string }> = [];
  if (info) {
    if (info.type === 'group') {
      rows.push({ label: t('sessionManagement.groupId'), value: info.id });
      if (info.member_count) {
        rows.push({ label: t('sessionManagement.memberCount'), value: String(info.member_count) });
      }
    } else {
      if (info.card) rows.push({ label: t('sessionManagement.senderCard'), value: info.card });
      if (info.role) {
        rows.push({
          label: t('sessionManagement.senderRole'),
          value: ROLE_KEY[info.role] ? t(ROLE_KEY[info.role]) : info.role,
        });
      }
      if (info.title) rows.push({ label: t('sessionManagement.senderTitle'), value: info.title });
      if (info.openid) rows.push({ label: 'openid', value: info.openid });
      rows.push({ label: t('sessionManagement.senderAccount'), value: info.id });
      if (info.unionid) rows.push({ label: 'unionid', value: info.unionid });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {info?.type === 'group'
              ? t('sessionManagement.groupInfo')
              : t('sessionManagement.userInfo')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t('sessionManagement.targetInfoDesc')}
          </DialogDescription>
        </DialogHeader>

        {loading && !info ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('sessionManagement.loading')}
          </div>
        ) : (
          <>
            <div className="mb-3 flex items-center gap-3 border-b border-border/60 pb-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm">
                {info?.avatar ? (
                  <img src={assetUrl(info.avatar)} alt={info.name} className="h-full w-full object-cover" />
                ) : (
                  (info?.name ?? '?').slice(0, 1)
                )}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{info?.name ?? '-'}</div>
                <div className="text-[11px] text-muted-foreground">
                  {info?.type === 'group'
                    ? t('sessionManagement.groupChat')
                    : t('sessionManagement.privateChat')}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
              {rows.map((row) => (
                <div key={row.label} className="contents">
                  <dt className="whitespace-nowrap text-muted-foreground">{row.label}</dt>
                  <dd className="break-all text-foreground/80">{row.value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t('sessionManagement.close')}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
