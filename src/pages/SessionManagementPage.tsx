import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  History,
  Trash2,
  User,
  Users,
  MessageSquare,
  Loader2,
  RefreshCw,
  Search,
  Brain,
  Clock,
  Hash,
  Send,
  Bot,
  ChevronLeft,
  MessageCircle,
  FileText
} from 'lucide-react';
import { historyApi, SessionInfo, SessionHistoryTextResponse, SessionHistoryJSONResponse, SessionPersonaResponse } from '@/lib/api';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'text' | 'json' | 'messages';

interface SessionDetail {
  session: SessionInfo;
  history: SessionHistoryTextResponse | SessionHistoryJSONResponse | null;
  persona: SessionPersonaResponse | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  user_name?: string | null;
  timestamp?: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatTimestamp = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '-';
  try {
    return format(new Date(timestamp * 1000), 'yyyy-MM-dd HH:mm:ss');
  } catch {
    return '-';
  }
};

const formatTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return '';
  try {
    return format(new Date(timestamp * 1000), 'HH:mm:ss');
  } catch {
    return '';
  }
};

const getSessionDisplayId = (session: SessionInfo): string => {
  // 新格式: {bot_id}%%%{group_id}%%%{user_id}
  // 优先使用 API 返回的 group_id 和 user_id 字段
  if (session.type === 'group' && session.group_id) {
    return session.group_id;
  }
  if (session.type === 'private' && session.user_id) {
    return session.user_id;
  }
  
  // 如果 API 没有返回 group_id/user_id，尝试从 session_id 解析
  const parts = session.session_id.split('%%%');
  if (parts.length === 3) {
    const [, groupId, userId] = parts;
    // 群聊时返回 group_id，私聊时返回 user_id
    return session.type === 'group' ? groupId : userId;
  }
  
  return session.session_id;
};

const getSessionTypeLabel = (type: string, t: (key: string) => string): string => {
  return type === 'private' ? t('sessionManagement.privateChat') : t('sessionManagement.groupChat');
};

// ============================================================================
// Component
// ============================================================================

export default function SessionManagementPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';
  const { t } = useLanguage();

  // State
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('json');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<SessionInfo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteCompletely, setDeleteCompletely] = useState(false);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await historyApi.getSessions();
      // Sort by last_access desc
      const sorted = data.sort((a, b) => (b.last_access || 0) - (a.last_access || 0));
      setSessions(sorted);
    } catch (error) {
      console.error('Failed to fetch sessions:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('sessionManagement.loadFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter(s => 
      s.session_id.toLowerCase().includes(query) ||
      (s.user_id && s.user_id.toLowerCase().includes(query)) ||
      (s.group_id && s.group_id.toLowerCase().includes(query))
    );
  }, [sessions, searchQuery]);

  // View session detail
  const handleSelectSession = async (session: SessionInfo) => {
    // 如果已经选中，则取消选中
    if (selectedSession?.session.session_id === session.session_id) {
      return;
    }
    
    try {
      setIsLoadingDetail(true);
      
      // Fetch history and persona in parallel (handle errors separately)
      let historyData = null;
      let personaData = null;
      
      try {
        historyData = await historyApi.getSessionHistory(session.session_id, viewMode);
      } catch (historyError) {
        console.log('History fetch error (may be normal for empty sessions):', historyError);
      }
      
      try {
        personaData = await historyApi.getSessionPersona(session.session_id);
      } catch (personaError) {
        console.log('Persona fetch error (may be normal for sessions without persona):', personaError);
      }

      setSelectedSession({
        session,
        history: historyData,
        persona: personaData
      });
    } catch (error) {
      console.error('Failed to fetch session detail:', error);
      toast({
        title: t('common.loadFailed'),
        description: t('sessionManagement.loadDetailFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Handle view mode change
  const handleViewModeChange = async (newMode: ViewMode) => {
    if (!selectedSession) return;
    
    setViewMode(newMode);
    try {
      const historyData = await historyApi.getSessionHistory(selectedSession.session.session_id, newMode);
      setSelectedSession(prev => prev ? { ...prev, history: historyData } : null);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  // Clear session history
  const handleClearSession = async () => {
    if (!sessionToDelete) return;
    
    try {
      setIsDeleting(true);
      await historyApi.clearSessionHistory(sessionToDelete.session_id, deleteCompletely);
      
      toast({
        title: t('common.success'),
        description: deleteCompletely 
          ? t('sessionManagement.deleteSuccess', { id: sessionToDelete.session_id })
          : t('sessionManagement.clearSuccess', { id: sessionToDelete.session_id })
      });
      
      // Refresh list
      await fetchSessions();
      
      // Close detail if viewing this session
      if (selectedSession?.session.session_id === sessionToDelete.session_id) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
      toast({
        title: t('common.error'),
        description: t('sessionManagement.clearFailed'),
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
      setSessionToDelete(null);
      setDeleteCompletely(false);
    }
  };

  // Parse messages for chat display
  const getChatMessages = (): ChatMessage[] => {
    if (!selectedSession?.history) return [];
    
    if (viewMode === 'json' || viewMode === 'messages') {
      const jsonData = selectedSession.history as SessionHistoryJSONResponse;
      if (jsonData.messages) {
        return jsonData.messages.map(msg => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
          user_name: msg.user_name,
          timestamp: msg.timestamp
        }));
      }
    }
    
    // For text mode, we can't easily parse into chat bubbles
    return [];
  };

  // Render chat message
  const renderChatMessage = (msg: ChatMessage, idx: number) => {
    const isUser = msg.role === 'user';
    
    return (
      <div key={idx} className={cn(
        "flex gap-2 sm:gap-3 mb-3 sm:mb-4",
        isUser ? "flex-row" : "flex-row-reverse"
      )}>
        {/* Avatar */}
        <div className={cn(
          "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0",
          isUser ? "bg-primary/20" : "bg-muted"
        )}>
          {isUser ? (
            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          ) : (
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
          )}
        </div>
        
        {/* Message Content */}
        <div className={cn(
          "flex flex-col max-w-[80%] sm:max-w-[70%]",
          isUser ? "items-start" : "items-end"
        )}>
          <div className={cn(
            "px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tl-none"
              : "bg-muted rounded-tr-none"
          )}>
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
          <span className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">
            {msg.user_name && <span className="mr-1 sm:mr-2">{msg.user_name}</span>}
            {formatTime(msg.timestamp)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-hidden h-full flex">
      {/* Left Sidebar - Session List */}
      <div className={cn(
        "border-r flex flex-col shrink-0 rounded-l-xl",
        "w-full absolute inset-0 z-10 sm:relative sm:w-72 md:w-80",
        isGlass ? "border-white/10 glass-card" : "border-border bg-card",
        selectedSession ? "hidden sm:flex" : "flex"
      )}>
        {/* Sidebar Header */}
        <div className="p-3 sm:p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h1 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <History className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              {t('sessionManagement.title')}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchSessions}
              disabled={isLoading}
              className="h-7 w-7 sm:h-8 sm:w-8"
            >
              {isLoading ? (
                <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
            </Button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground" />
            <Input
              placeholder={t('sessionManagement.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={cn("pl-9 sm:pl-10 h-8 sm:h-9 text-sm rounded-lg", isGlass && "glass-card")}
            />
          </div>
        </div>

        {/* Session List */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-primary" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 px-4 text-sm">
              {searchQuery ? t('sessionManagement.noSearchResults') : t('sessionManagement.noSessions')}
            </div>
          ) : (
            <div className="p-1.5 sm:p-2 space-y-1">
              {filteredSessions.map((session) => {
                const isSelected = selectedSession?.session.session_id === session.session_id;
                const displayId = getSessionDisplayId(session);
                const isGroup = session.type === 'group';
                
                return (
                  <button
                      key={session.session_id}
                      onClick={() => handleSelectSession(session)}
                      className={cn(
                        "w-full p-2.5 sm:p-3 rounded-xl text-left transition-all",
                        "hover:bg-accent/50",
                        isSelected && "bg-primary/10 hover:bg-primary/10 border-l-2 border-primary"
                      )}
                    >
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      {/* Avatar */}
                      <div className={cn(
                        "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0",
                        isGroup ? "bg-green-500/20" : "bg-blue-500/20"
                      )}>
                        {isGroup ? (
                          <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                        ) : (
                          <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* First row: ID */}
                        <div className="font-medium text-sm truncate" title={displayId}>
                          {displayId}
                        </div>
                        {/* Second row: Badge and Stats */}
                        <div className="flex items-center gap-2 mt-1">
                          <Badge
                            variant="secondary"
                            className={cn(
                              "text-[10px] px-1.5 py-0 h-4 shrink-0",
                              isGroup
                                ? "bg-green-500/20 text-green-600 hover:bg-green-500/30"
                                : "bg-primary/20 text-primary hover:bg-primary/30"
                            )}
                          >
                            {isGroup ? t('sessionManagement.group') : t('sessionManagement.private')}
                          </Badge>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MessageSquare className="w-3 h-3" />
                            {session.message_count}
                          </span>
                          {session.last_access && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                              <Clock className="w-3 h-3 shrink-0" />
                              <span className="truncate">{formatTimestamp(session.last_access)}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right Content Area */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 rounded-r-xl overflow-hidden",
        isGlass ? "bg-background/50 backdrop-blur-md border border-white/10" : "bg-background border border-border"
      )}>
        {selectedSession ? (
          <>
            {/* Chat Header */}
            <div className={cn(
              "h-14 sm:h-16 border-b px-3 sm:px-4 flex items-center justify-between shrink-0",
              isGlass ? "border-white/10 bg-background/50" : "border-border bg-card"
            )}>
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden h-8 w-8 shrink-0"
                  onClick={() => setSelectedSession(null)}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                
                <div className={cn(
                  "w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0",
                  selectedSession.session.type === 'group' ? "bg-green-500/20" : "bg-blue-500/20"
                )}>
                  {selectedSession.session.type === 'group' ? (
                    <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                  ) : (
                    <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-sm sm:text-base truncate">
                    {getSessionDisplayId(selectedSession.session)}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedSession.session.type === 'group'
                      ? t('sessionManagement.groupChat')
                      : t('sessionManagement.privateChat')}
                    {selectedSession.persona?.persona_content && (
                      <span className="ml-1 sm:ml-2 text-primary">· {t('sessionManagement.hasPersona')}</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* View Mode Toggle - TabButtonGroup */}
                <div className="hidden sm:block">
                  <TabButtonGroup
                    options={[
                      { value: 'json', label: t('sessionManagement.chatMode'), icon: <MessageCircle className="w-4 h-4" /> },
                      { value: 'text', label: t('sessionManagement.textMode'), icon: <FileText className="w-4 h-4" /> },
                    ]}
                    value={viewMode}
                    onValueChange={(value) => handleViewModeChange(value as ViewMode)}
                    glassClassName={isGlass ? 'glass-card' : 'border border-border/50'}
                  />
                </div>
                
                {/* Mobile view mode toggle - icon only */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden h-8 w-8 rounded-lg"
                  onClick={() => handleViewModeChange(viewMode === 'json' ? 'text' : 'json')}
                >
                  {viewMode === 'json' ? <MessageSquare className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                </Button>
                
                <Button
                  variant="destructive"
                  onClick={() => setSessionToDelete(selectedSession.session)}
                  className="gap-2 px-4 py-2 h-auto rounded-md"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('common.clear')}</span>
                </Button>
              </div>
            </div>

            {/* Chat Content */}
            <div className="flex-1 overflow-hidden flex">
              {/* Messages Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {isLoadingDetail ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : viewMode === 'json' ? (
                  <>
                    <ScrollArea className="flex-1 p-4">
                      <div className="space-y-2">
                        {getChatMessages().length > 0 ? (
                          getChatMessages().map((msg, idx) => renderChatMessage(msg, idx))
                        ) : (
                          <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>{t('sessionManagement.noHistory')}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                    
                    {/* Input Area (Decorative) */}
                    <div className={cn(
                      "p-2 sm:p-4 border-t",
                      isGlass ? "border-white/10 bg-background/30" : "border-border bg-muted/30"
                    )}>
                      <div className="flex items-center gap-2 max-w-4xl mx-auto">
                        <Input
                          placeholder={t('sessionManagement.inputPlaceholder')}
                          disabled
                          className={cn("flex-1 h-9 sm:h-10 text-sm rounded-lg", isGlass && "glass-card")}
                        />
                        <Button size="icon" disabled className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-lg">
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  // Text Mode
                  <ScrollArea className="flex-1 p-4">
                    <div className="max-w-4xl mx-auto">
                      {selectedSession.history ? (
                        <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed bg-muted/50 p-4 rounded-lg">
                          {(selectedSession.history as SessionHistoryTextResponse).content || t('sessionManagement.noHistory')}
                        </pre>
                      ) : (
                        <div className="text-center text-muted-foreground py-12">
                          <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>{t('sessionManagement.noHistory')}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </div>

              {/* Persona Sidebar (Right) */}
              {selectedSession.persona?.persona_content && (
                <div className={cn(
                  "w-64 lg:w-72 border-l shrink-0 hidden lg:block",
                  isGlass ? "border-white/10 bg-background/30" : "border-border bg-muted/30"
                )}>
                  <div className="p-3 sm:p-4 border-b border-border/50">
                    <h3 className="font-medium flex items-center gap-2 text-sm sm:text-base">
                      <Brain className="w-4 h-4" />
                      {t('sessionManagement.persona')}
                    </h3>
                  </div>
                  <ScrollArea className="h-[calc(100vh-10rem)]">
                    <div className="p-3 sm:p-4">
                      <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed text-muted-foreground">
                        {selectedSession.persona.persona_content}
                      </pre>
                    </div>
                  </ScrollArea>
                </div>
              )}
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center p-4">
            <Card className={cn("max-w-sm sm:max-w-md w-full rounded-xl", isGlass && "glass-card")}>
              <CardContent className="p-6 sm:p-8 text-center">
                <History className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 text-muted-foreground/50" />
                <h3 className="text-base sm:text-lg font-medium mb-1 sm:mb-2">{t('sessionManagement.selectSession')}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('sessionManagement.selectSessionDesc')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Clear Confirmation Dialog */}
      <AlertDialog open={!!sessionToDelete} onOpenChange={() => setSessionToDelete(null)}>
        <AlertDialogContent className={cn("max-w-sm sm:max-w-lg rounded-xl", isGlass && "glass-card")}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Trash2 className="w-5 h-5 text-destructive" />
              {t('sessionManagement.confirmClear')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {t('sessionManagement.confirmClearMessage', { id: sessionToDelete?.session_id })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-center gap-2 py-3 sm:py-4">
            <input
              type="checkbox"
              id="delete-completely"
              checked={deleteCompletely}
              onChange={(e) => setDeleteCompletely(e.target.checked)}
              className="rounded border-gray-300 w-4 h-4"
            />
            <label htmlFor="delete-completely" className="text-sm text-muted-foreground cursor-pointer">
              {t('sessionManagement.deleteCompletely')}
            </label>
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => setDeleteCompletely(false)} className="h-9 sm:h-10">
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearSession}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-9 sm:h-10"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1" />
              )}
              {t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
