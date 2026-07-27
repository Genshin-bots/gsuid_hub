import { cn } from '@/lib/utils';
import type { ConnectionState, Conversation } from '@/lib/liveChat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageCircle,
  Plus,
  Search,
  Users,
  User,
  Trash2,
  Settings2,
  Loader2,
} from 'lucide-react';
import { ConnectionBadge } from './ConnectionBadge';
import { format } from 'date-fns';

interface ConversationSidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  search: string;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
  connectionState: ConnectionState;
  connectionLabel: string;
  identityLabel: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function ConversationSidebar({
  conversations,
  activeId,
  search,
  onSearchChange,
  onSelect,
  onCreate,
  onDelete,
  onOpenSettings,
  connectionState,
  connectionLabel,
  identityLabel,
  t,
}: ConversationSidebarProps) {
  const filtered = search.trim()
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          c.targetId.toLowerCase().includes(q) ||
          c.type.includes(q)
        );
      })
    : conversations;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header：标题 + 操作同一行，连接状态紧随，避免纵向堆叠过密 */}
      <div className="shrink-0 space-y-2.5 border-b border-border/50 p-3 sm:p-3.5">
        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <MessageCircle className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="truncate text-base font-semibold sm:text-lg">{t('liveChat.title')}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onOpenSettings}
              title={t('liveChat.settings')}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onCreate}
              title={t('liveChat.newChat')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ConnectionBadge state={connectionState} label={connectionLabel} />
          <button
            type="button"
            onClick={onOpenSettings}
            className="min-w-0 truncate text-left text-[11px] text-muted-foreground hover:text-foreground"
            title={identityLabel}
          >
            {t('liveChat.asUser')}:{' '}
            <span className="font-medium text-foreground/80">{identityLabel}</span>
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('liveChat.searchPlaceholder')}
            className="h-9 rounded-lg pl-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="space-y-3 px-4 py-10 text-center text-sm text-muted-foreground">
            <p>{search ? t('liveChat.noSearchResults') : t('liveChat.noConversations')}</p>
            {!search && (
              <Button variant="outline" size="sm" className="h-9" onClick={onCreate}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('liveChat.newChat')}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 p-1.5 sm:p-2">
            {filtered
              .slice()
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .map((c) => {
                const isActive = c.id === activeId;
                const isGroup = c.type === 'group';
                let time = '';
                try {
                  // 跨天显示月-日，当天只显示时:分
                  const d = new Date(c.updatedAt);
                  const now = new Date();
                  const sameDay =
                    d.getFullYear() === now.getFullYear() &&
                    d.getMonth() === now.getMonth() &&
                    d.getDate() === now.getDate();
                  time = format(d, sameDay ? 'HH:mm' : 'MM-dd HH:mm');
                } catch {
                  /* ignore */
                }
                const preview = c.lastPreview || '—';
                return (
                  <div
                    key={c.id}
                    className={cn(
                      'group relative rounded-xl transition-colors',
                      'hover:bg-accent/50',
                      isActive && 'bg-primary/10 hover:bg-primary/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className="flex w-full items-center gap-3 px-3 py-3 text-left sm:px-3.5 sm:py-3.5"
                    >
                      <Avatar className="h-11 w-11 shrink-0">
                        <AvatarFallback
                          className={cn(isGroup ? 'bg-amber-500/20' : 'bg-sky-500/20')}
                        >
                          {isGroup ? (
                            <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          ) : (
                            <User className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                          )}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 pr-7">
                        {/* 第 1 行：badge + id | 最后发送时间 */}
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-sm font-medium leading-none',
                              isGroup
                                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                                : 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
                            )}
                          >
                            {isGroup ? t('liveChat.group') : t('liveChat.direct')}
                          </span>
                          <span
                            className="min-w-0 flex-1 truncate text-sm font-medium leading-none"
                            title={c.targetId}
                          >
                            {c.targetId}
                          </span>
                          {time && (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {time}
                            </span>
                          )}
                        </div>
                        {/* 第 2 行：最近消息预览 */}
                        <p className="mt-1.5 truncate text-xs text-muted-foreground" title={preview}>
                          {preview}
                        </p>
                      </div>
                    </button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'absolute right-1.5 top-1/2 h-7 w-7 -translate-y-1/2',
                        'text-muted-foreground opacity-0 transition-opacity',
                        'hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      title={t('liveChat.deleteChat')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
          </div>
        )}
      </ScrollArea>

      {connectionState === 'connecting' && (
        <div className="flex items-center justify-center gap-2 border-t border-border/40 p-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('liveChat.connecting')}
        </div>
      )}
    </div>
  );
}
