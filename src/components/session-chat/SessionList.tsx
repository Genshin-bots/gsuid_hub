/**
 * 左侧会话列表。
 *
 * 顶部按 Bot 切换、全部 / 群聊 / 私聊分开，下面搜索框。
 * 右键菜单：置顶 / 修改备注 / 查看信息 / 拉黑。
 * 置顶与备注是面板自己的状态（存在 core 的 data 目录）；
 * 拉黑写的是框架级全局黑名单 `sp_config.BlackList`，命中后真的不再触发命令。
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Eraser,
  Info,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserCog,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
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

export type ChatType = 'all' | 'group' | 'private' | 'virtual';

const CHAT_TYPE_VALUES = ['all', 'group', 'private', 'virtual'] as const;
const CHAT_TYPE_LABEL_KEY: Record<ChatType, string> = {
  all: 'sessionManagement.all',
  group: 'sessionManagement.groupChat',
  private: 'sessionManagement.privateChat',
  virtual: 'sessionManagement.virtualChat',
};

interface SessionListProps {
  sessions: SessionItem[];
  /** 自主创建的持久化虚拟会话列表 */
  virtualSessions?: SessionItem[];
  activeId?: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  botKey: string;
  onBotChange: (value: string) => void;
  chatType: ChatType;
  onChatTypeChange: (value: ChatType) => void;
  /** 后面还有没有下一页，滚到底时去拉 */
  hasMore?: boolean;
  loadingMore?: boolean;
  /** 服务端统计的会话总数；分页后 sessions 只是一页，计数不能拿它算 */
  total?: number;
  onLoadMore?: () => void;
  onSelect: (session: SessionItem) => void;
  onTogglePin: (session: SessionItem) => void;
  onEditNote: (session: SessionItem, note: string) => void;
  onViewInfo: (session: SessionItem) => void;
  onToggleBlacklist: (session: SessionItem) => void;
  /** 点击创建持久化虚拟会话 */
  onCreateVirtual?: (defaultType?: 'group' | 'direct') => void;
  /** 打开虚拟身份设置 */
  onOpenIdentitySettings?: () => void;
  /** 清空虚拟会话消息 */
  onClearVirtualMessages?: (session: SessionItem) => void;
  /** 删除虚拟会话 */
  onDeleteVirtualSession?: (session: SessionItem) => void;
}

export function SessionList({
  sessions,
  virtualSessions = [],
  activeId,
  keyword,
  onKeywordChange,
  botKey,
  onBotChange,
  chatType,
  onChatTypeChange,
  hasMore = false,
  loadingMore = false,
  total,
  onLoadMore,
  onSelect,
  onTogglePin,
  onEditNote,
  onViewInfo,
  onToggleBlacklist,
  onCreateVirtual,
  onOpenIdentitySettings,
  onClearVirtualMessages,
  onDeleteVirtualSession,
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
    for (const item of [...sessions, ...virtualSessions]) {
      const key = botKeyOf(item);
      if (!map.has(key)) {
        map.set(key, item.bot_self_id || item.bot_id || t('sessionManagement.botUnnamed'));
      }
    }
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [sessions, virtualSessions, t]);

  // 当前选中的 Bot 被删干净了就退回「全部」，否则列表会一直空着
  useEffect(() => {
    if (botKey === 'all') return;
    if (botOptions.some((item) => item.value === botKey)) return;
    if (botOptions.length > 0) onBotChange('all');
  }, [botKey, botOptions, onBotChange]);

  const combinedSource = useMemo(() => {
    if (chatType === 'virtual') {
      return [...virtualSessions].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.last_time || 0) - (a.last_time || 0);
      });
    }
    if (chatType === 'all') {
      const all = [...virtualSessions, ...sessions];
      return all.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.last_time || 0) - (a.last_time || 0);
      });
    }
    return sessions;
  }, [chatType, sessions, virtualSessions]);

  const visible = combinedSource.filter((item) => {
    if (chatType !== 'virtual' && botKey !== 'all' && botKeyOf(item) !== botKey) return false;
    if (chatType === 'group' && (item.virtual || item.type !== 'group')) return false;
    if (chatType === 'private' && (item.virtual || item.type !== 'private')) return false;
    if (chatType === 'virtual' && !item.virtual) return false;
    const q = keyword.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      (item.note ?? '').toLowerCase().includes(q) ||
      String(item.group_id ?? '').includes(q) ||
      String(item.user_id ?? '').includes(q)
    );
  });

  // 有筛选（搜索 / Bot / 群私聊 / 虚拟）时只能数已经加载的；没筛选就报服务端的总数 + 虚拟会话数
  const filtered = Boolean(keyword.trim()) || botKey !== 'all' || chatType !== 'all';
  const shownCount = filtered
    ? visible.length
    : Math.max((total ?? 0) + virtualSessions.length, visible.length);

  return (
    <div className="flex h-full min-h-0 w-full shrink-0 flex-col border-r border-border/60 sm:w-72">
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
          className="w-full flex-nowrap"
          buttonClassName="flex-1 !px-1.5 sm:!px-2 text-xs"
        />

        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && hasMore && !loadingMore && chatType !== 'virtual') {
                onLoadMore?.();
              }
            }}
            placeholder={
              chatType === 'virtual'
                ? t('sessionManagement.searchVirtualPlaceholder')
                : chatType === 'private'
                  ? t('sessionManagement.searchPrivatePlaceholder')
                  : chatType === 'group'
                    ? t('sessionManagement.searchGroupPlaceholder')
                    : t('sessionManagement.searchPlaceholder')
            }
            className="h-8 pl-7 text-xs"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t('sessionManagement.sessionCount', { count: shownCount })}</span>
          <div className="flex items-center gap-2">
            {chatType === 'virtual' && onOpenIdentitySettings && (
              <button
                type="button"
                onClick={onOpenIdentitySettings}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <UserCog className="h-3 w-3" />
                <span>{t('sessionManagement.identitySettings')}</span>
              </button>
            )}
            <span>
              {t('sessionManagement.pinnedCount', {
                count: visible.filter((item) => item.pinned).length,
              })}
            </span>
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-2 pb-3"
        onScroll={(event) => {
          const node = event.currentTarget;
          if (chatType === 'virtual' || !hasMore || loadingMore) return;
          if (node.scrollHeight - node.scrollTop - node.clientHeight > 80) return;
          onLoadMore?.();
        }}
      >
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center px-2 py-6 text-center text-xs text-muted-foreground">
            <p>
              {keyword.trim()
                ? t('sessionManagement.noSearchResults')
                : chatType === 'virtual'
                  ? t('sessionManagement.noVirtualSessions')
                  : chatType === 'group'
                    ? t('sessionManagement.noGroupSessions')
                    : chatType === 'private'
                      ? t('sessionManagement.noPrivateSessions')
                      : t('sessionManagement.noSessions')}
            </p>
            {chatType !== 'virtual' && hasMore && (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={onLoadMore}
                className="mt-3 h-7 text-xs"
              >
                {loadingMore ? t('sessionManagement.loadingMore') : t('sessionManagement.loadMore')}
              </Button>
            )}
          </div>
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
                  activeId === item.session_id
                    ? item.virtual
                      ? 'bg-violet-500/15 ring-1 ring-violet-500/30'
                      : 'bg-primary/10'
                    : 'hover:bg-muted/60',
                  item.blacklisted && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (item.virtual && onOpenIdentitySettings) {
                      onOpenIdentitySettings();
                    } else {
                      onViewInfo(item);
                    }
                  }}
                  title={
                    item.virtual
                      ? t('sessionManagement.identitySettings')
                      : t('sessionManagement.viewInfo')
                  }
                  className="shrink-0 rounded-full transition-opacity hover:opacity-80"
                >
                  <SessionAvatar
                    src={item.avatar}
                    name={item.note || item.title}
                    type={item.type}
                  />
                </button>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    {item.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                    {item.virtual && (
                      <Badge
                        variant="outline"
                        className="h-4 shrink-0 border-violet-500/35 bg-violet-500/10 px-1 py-0 text-[10px] font-normal text-violet-600 dark:text-violet-400"
                      >
                        <Sparkles className="mr-0.5 h-2.5 w-2.5" />
                        {item.type === 'group'
                          ? t('sessionManagement.virtualBadgeGroup')
                          : t('sessionManagement.virtualBadgePrivate')}
                      </Badge>
                    )}
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
            <ContextMenuContent className="w-48">
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
              {item.virtual ? (
                <>
                  {onOpenIdentitySettings && (
                    <ContextMenuItem onSelect={onOpenIdentitySettings}>
                      <UserCog className="mr-2 h-3.5 w-3.5" />
                      {t('sessionManagement.identitySettings')}
                    </ContextMenuItem>
                  )}
                  {onClearVirtualMessages && (
                    <ContextMenuItem onSelect={() => onClearVirtualMessages(item)}>
                      <Eraser className="mr-2 h-3.5 w-3.5" />
                      {t('sessionManagement.clearVirtualMessages')}
                    </ContextMenuItem>
                  )}
                  {onDeleteVirtualSession && (
                    <>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => onDeleteVirtualSession(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        {t('sessionManagement.deleteVirtualSession')}
                      </ContextMenuItem>
                    </>
                  )}
                </>
              ) : (
                <>
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
                    {item.blacklisted
                      ? t('sessionManagement.unblacklist')
                      : t('sessionManagement.blacklist')}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        ))}

        {chatType !== 'virtual' && visible.length > 0 && hasMore && (
          <div className="pt-2 text-center">
            <Button
              variant="ghost"
              size="sm"
              disabled={loadingMore}
              onClick={onLoadMore}
              className="h-7 w-full text-xs text-muted-foreground hover:text-foreground"
            >
              {loadingMore ? t('sessionManagement.loadingMore') : t('sessionManagement.loadMore')}
            </Button>
          </div>
        )}

        {onCreateVirtual && (
          <div className="mt-2 px-0.5">
            <button
              type="button"
              onClick={() =>
                onCreateVirtual(
                  chatType === 'group' ? 'group' : chatType === 'private' ? 'direct' : undefined,
                )
              }
              className="group flex w-full items-center gap-2.5 rounded-lg border border-dashed border-violet-500/40 bg-violet-500/[0.04] px-2.5 py-2 text-left transition-all hover:border-violet-500/70 hover:bg-violet-500/10"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15 text-violet-600 dark:text-violet-400 transition-transform group-hover:scale-105">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate text-xs font-medium text-foreground">
                  <span className="truncate">{t('sessionManagement.createVirtualSession')}</span>
                </span>
                <span className="block truncate text-[10px] text-muted-foreground">
                  {t('sessionManagement.createVirtualSessionHint')}
                </span>
              </span>
            </button>
          </div>
        )}
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
