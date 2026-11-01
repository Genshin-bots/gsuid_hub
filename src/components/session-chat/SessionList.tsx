/**
 * 左侧会话列表。
 *
 * 顶部按 Bot 切换、全部 / 群聊 / 私聊分开，下面搜索框。
 * 右键菜单：置顶 / 修改备注 / 查看信息 / 拉黑。
 * 置顶与备注是面板自己的状态（存在 core 的 data 目录）；
 * 拉黑写的是框架级全局黑名单 `sp_config.BlackList`，命中后真的不再触发命令。
 */
import { useEffect, useMemo, useState } from 'react';
import { Ban, Info, Pin, PinOff, Pencil, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { botKeyOf, formatListTime, type SessionItem } from '@/lib/sessionChat';
import { SessionAvatar } from './SessionAvatar';

export type ChatType = 'all' | 'group' | 'private';

const CHAT_TYPE_VALUES = ['all', 'group', 'private'] as const;
const CHAT_TYPE_LABEL_KEY: Record<ChatType, string> = {
  all: 'sessionManagement.all',
  group: 'sessionManagement.groupChat',
  private: 'sessionManagement.privateChat',
};

interface SessionListProps {
  sessions: SessionItem[];
  activeId?: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  botKey: string;
  onBotChange: (value: string) => void;
  chatType: ChatType;
  onChatTypeChange: (value: ChatType) => void;
  onSelect: (session: SessionItem) => void;
  onTogglePin: (session: SessionItem) => void;
  onEditNote: (session: SessionItem, note: string) => void;
  onViewInfo: (session: SessionItem) => void;
  onToggleBlacklist: (session: SessionItem) => void;
}

export function SessionList({
  sessions,
  activeId,
  keyword,
  onKeywordChange,
  botKey,
  onBotChange,
  chatType,
  onChatTypeChange,
  onSelect,
  onTogglePin,
  onEditNote,
  onViewInfo,
  onToggleBlacklist,
}: SessionListProps) {
  const { t } = useLanguage();
  const [noteTarget, setNoteTarget] = useState<SessionItem | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  useEffect(() => {
    if (noteTarget) setNoteDraft(noteTarget.note ?? '');
  }, [noteTarget]);

  const chatTypeOptions = useMemo(
    () => CHAT_TYPE_VALUES.map((value) => ({ value, label: t(CHAT_TYPE_LABEL_KEY[value]) })),
    [t],
  );

  // Bot 列表直接从会话里聚合：只列出发过消息的号，冷启动时也不会空
  const botOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of sessions) {
      const key = botKeyOf(item);
      if (!map.has(key)) {
        map.set(key, item.bot_self_id || item.bot_id || t('sessionManagement.botUnnamed'));
      }
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [sessions, t]);

  // 当前选中的 Bot 被删干净了就退回「全部」，否则列表会一直空着
  useEffect(() => {
    if (botKey === 'all') return;
    if (botOptions.some((item) => item.value === botKey)) return;
    if (botOptions.length > 0) onBotChange('all');
  }, [botKey, botOptions, onBotChange]);

  const visible = sessions.filter((item) => {
    if (botKey !== 'all' && botKeyOf(item) !== botKey) return false;
    if (chatType !== 'all' && item.type !== chatType) return false;
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.note ?? '').toLowerCase().includes(q) ||
      String(item.group_id ?? '').includes(q) ||
      String(item.user_id ?? '').includes(q)
    );
  });

  return (
    <div className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-border/60">
      <div className="shrink-0 space-y-2 px-3 pb-2 pt-3">
        <Select value={botKey} onValueChange={onBotChange}>
          <SelectTrigger className="h-9 text-xs">
            <SelectValue placeholder={t('sessionManagement.botSelectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('sessionManagement.botAll')}</SelectItem>
            {botOptions.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <TabButtonGroup
          options={chatTypeOptions}
          value={chatType}
          onValueChange={(value) => onChatTypeChange(value as ChatType)}
          size="sm"
          className="w-full"
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            placeholder={
              chatType === 'private'
                ? t('sessionManagement.searchPrivatePlaceholder')
                : chatType === 'group'
                  ? t('sessionManagement.searchGroupPlaceholder')
                  : t('sessionManagement.searchPlaceholder')
            }
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t('sessionManagement.sessionCount', { count: visible.length })}</span>
          <span>
            {t('sessionManagement.pinnedCount', {
              count: visible.filter((item) => item.pinned).length,
            })}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {visible.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {keyword.trim()
              ? t('sessionManagement.noSearchResults')
              : chatType === 'group'
                ? t('sessionManagement.noGroupSessions')
                : chatType === 'private'
                  ? t('sessionManagement.noPrivateSessions')
                  : t('sessionManagement.noSessions')}
          </p>
        )}
        {visible.map((item) => (
          <ContextMenu key={item.session_id}>
            <ContextMenuTrigger asChild>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(item)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return;
                  event.preventDefault();
                  onSelect(item);
                }}
                className={cn(
                  'mb-1 flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                  activeId === item.session_id ? 'bg-primary/10' : 'hover:bg-muted/60',
                  item.blacklisted && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewInfo(item);
                  }}
                  title={t('sessionManagement.viewInfo')}
                  className="shrink-0 rounded-full transition-opacity hover:opacity-80"
                >
                  <SessionAvatar src={item.avatar} name={item.note || item.title} type={item.type} />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    {item.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                    <span className="truncate text-sm font-medium">{item.note || item.title}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                      {formatListTime(item.last_time || item.last_access)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-center gap-1">
                    <span className="truncate text-[11px] text-muted-foreground">
                      {item.last_role === 'assistant' && t('sessionManagement.botPrefix')}
                      {item.last_preview || t('sessionManagement.noMessagesShort')}
                    </span>
                    {item.blacklisted && <Ban className="h-3 w-3 shrink-0 text-destructive" />}
                  </span>
                </span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent className="w-44">
              <ContextMenuItem onSelect={() => onTogglePin(item)}>
                {item.pinned ? (
                  <PinOff className="mr-2 h-3.5 w-3.5" />
                ) : (
                  <Pin className="mr-2 h-3.5 w-3.5" />
                )}
                {item.pinned ? t('sessionManagement.unpin') : t('sessionManagement.pin')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => setNoteTarget(item)}>
                <Pencil className="mr-2 h-3.5 w-3.5" />
                {t('sessionManagement.editNote')}
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => onViewInfo(item)}>
                <Info className="mr-2 h-3.5 w-3.5" />
                {item.type === 'group'
                  ? t('sessionManagement.viewGroupInfo')
                  : t('sessionManagement.viewUserInfo')}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                onSelect={() => onToggleBlacklist(item)}
                className="text-destructive focus:text-destructive"
              >
                <Ban className="mr-2 h-3.5 w-3.5" />
                {item.blacklisted ? t('sessionManagement.unblacklist') : t('sessionManagement.blacklist')}
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>

      <Dialog open={noteTarget !== null} onOpenChange={(open) => !open && setNoteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('sessionManagement.editNote')}</DialogTitle>
            <DialogDescription>{t('sessionManagement.noteHint')}</DialogDescription>
          </DialogHeader>
          <Input
            value={noteDraft}
            maxLength={64}
            onChange={(event) => setNoteDraft(event.target.value)}
            placeholder={noteTarget?.title ?? ''}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteTarget(null)}>
              {t('sessionManagement.cancel')}
            </Button>
            <Button
              onClick={() => {
                if (noteTarget) onEditNote(noteTarget, noteDraft.trim());
                setNoteTarget(null);
              }}
            >
              {t('sessionManagement.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
