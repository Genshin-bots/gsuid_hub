import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { ClipboardEvent, DragEvent } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
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
  FileText,
  Image as ImageIcon,
  Upload,
  X
} from 'lucide-react';
import { historyApi, SessionInfo, SessionHistoryTextResponse, SessionHistoryJSONResponse, SessionHistoryOpenAIResponse, SessionPersonaResponse } from '@/lib/api';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// ============================================================================
// Types
// ============================================================================

type ViewMode = 'text' | 'json' | 'messages';

interface SessionDetail {
  session: SessionInfo;
  history: SessionHistoryTextResponse | SessionHistoryJSONResponse | SessionHistoryOpenAIResponse | null;
  persona: SessionPersonaResponse | null;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  user_name?: string | null;
  user_avatar?: string | null;
  timestamp?: number;
}

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
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
  // 新格式: bot:{bot_id}:group:{group_id} 或 bot:{bot_id}:private:{user_id}
  // 优先使用 API 返回的 group_id 和 user_id 字段
  if (session.type === 'group' && session.group_id) {
    return session.group_id;
  }
  if (session.type === 'private' && session.user_id) {
    return session.user_id;
  }
  
  // 如果 API 没有返回 group_id/user_id，尝试从 session_id 解析
  // 格式: bot:{bot_id}:group:{group_id} 或 bot:{bot_id}:private:{user_id}
  const groupMatch = session.session_id.match(/^bot:\d+:group:(.+)$/);
  const privateMatch = session.session_id.match(/^bot:\d+:private:(.+)$/);
  
  if (groupMatch) {
    return groupMatch[1];
  }
  if (privateMatch) {
    return privateMatch[1];
  }
  
  return session.session_id;
};

const getBotId = (session: SessionInfo): string => {
  // 从 session_id 解析 bot_id
  // 格式: bot:{bot_id}:group:{group_id} 或 bot:{bot_id}:private:{user_id}
  const match = session.session_id.match(/^bot:(\d+):/);
  return match ? match[1] : '0';
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
  const [messageText, setMessageText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const textScrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部：进入会话 / 视图模式切换 / 消息更新时触发
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    // 1) 优先使用 messagesEndRef 锚点（chat mode）
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior, block: 'end' });
      return;
    }
    // 2) 兜底：通过 chatScrollRef 找到 Radix 的 viewport 并滚动到底
    const viewport = chatScrollRef.current?.querySelector<HTMLElement>(
      '[data-radix-scroll-area-viewport]'
    );
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, []);

  useEffect(() => {
    pendingImagesRef.current = pendingImages;
  }, [pendingImages]);

  useEffect(() => {
    return () => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  // 选中会话 / 视图模式切换 / 消息更新后，自动滚动到底部
  useEffect(() => {
    if (!selectedSession) return;

    if (viewMode === 'json' || viewMode === 'messages') {
      // 需要等消息渲染完成后再滚动
      const timer = window.setTimeout(() => {
        scrollToBottom('auto');
      }, 0);
      return () => window.clearTimeout(timer);
    }

    if (viewMode === 'text') {
      const viewport = textScrollRef.current?.querySelector<HTMLElement>(
        '[data-radix-scroll-area-viewport]'
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [selectedSession, viewMode, selectedSession?.history, scrollToBottom]);

  const addImageFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    setPendingImages((prev) => [
      ...prev,
      ...imageFiles.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file)
      }))
    ]);
  };

  const removePendingImage = (imageId: string) => {
    setPendingImages((prev) => {
      const image = prev.find((item) => item.id === imageId);
      if (image) URL.revokeObjectURL(image.previewUrl);
      return prev.filter((item) => item.id !== imageId);
    });
  };

  const clearPendingImages = () => {
    setPendingImages((prev) => {
      prev.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
  };

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
      toast.error(t('sessionManagement.loadFailed'));
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

  const loadSessionDetail = async (session: SessionInfo, mode: ViewMode = viewMode) => {
    let historyData = null;
    let personaData = null;

    try {
      historyData = await historyApi.getSessionHistory(session.session_id, mode);
    } catch (historyError) {
      console.log('History fetch error (may be normal for empty sessions):', historyError);
    }

    try {
      personaData = await historyApi.getSessionPersona(session.session_id);
    } catch (personaError) {
      console.log('Persona fetch error (may be normal for sessions without persona):', personaError);
    }

    return {
      session,
      history: historyData,
      persona: personaData
    };
  };

  // View session detail
  const handleSelectSession = async (session: SessionInfo) => {
    // 如果已经选中，则取消选中
    if (selectedSession?.session.session_id === session.session_id) {
      return;
    }
    
    try {
      setIsLoadingDetail(true);
      
      setSelectedSession(await loadSessionDetail(session));
      setMessageText('');
      clearPendingImages();
    } catch (error) {
      console.error('Failed to fetch session detail:', error);
      toast.error(t('sessionManagement.loadDetailFailed'));
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

  const handleSendMessage = async () => {
    if (!selectedSession || (!messageText.trim() && pendingImages.length === 0)) return;

    try {
      setIsSending(true);
      await historyApi.sendSessionMessage(selectedSession.session.session_id, {
        message: messageText.trim(),
        images: pendingImages.map((image) => image.file),
        at_sender: false
      });

      toast.success(t('sessionManagement.sendSuccess'));

      setMessageText('');
      clearPendingImages();
      setSelectedSession(await loadSessionDetail(selectedSession.session, viewMode));
      await fetchSessions();
    } catch (error) {
      console.error('Failed to send session message:', error);
      toast.error(error instanceof Error ? error.message : t('sessionManagement.sendFailed'));
    } finally {
      setIsSending(false);
    }
  };

  // Clear session history
  const handleClearSession = async () => {
    if (!sessionToDelete) return;
    
    try {
      setIsDeleting(true);
      await historyApi.clearSessionHistory(sessionToDelete.session_id, deleteCompletely);
      
      toast.success(deleteCompletely 
          ? t('sessionManagement.deleteSuccess', { id: sessionToDelete.session_id })
          : t('sessionManagement.clearSuccess', { id: sessionToDelete.session_id }));
      
      // Refresh list
      await fetchSessions();
      
      // Close detail if viewing this session
      if (selectedSession?.session.session_id === sessionToDelete.session_id) {
        setSelectedSession(null);
      }
    } catch (error) {
      console.error('Failed to clear session:', error);
      toast.error(t('sessionManagement.clearFailed'));
    } finally {
      setIsDeleting(false);
      setSessionToDelete(null);
      setDeleteCompletely(false);
    }
  };

  const handlePasteImages = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(event.clipboardData.files).filter((file) => file.type.startsWith('image/'));
    if (files.length > 0) {
      addImageFiles(files);
    }
  };

  const handleDropImages = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingImages(false);
    addImageFiles(event.dataTransfer.files);
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
          user_avatar: msg.user_avatar,
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
          "w-7 h-7 sm:w-8 sm:h-8 shrink-0 rounded-full flex items-center justify-center",
          isUser
            ? (msg.user_avatar ? "" : "bg-primary/20 text-primary")
            : "bg-muted text-muted-foreground"
        )}>
          {isUser && msg.user_avatar ? (
            <Avatar className="w-full h-full">
              <AvatarImage src={msg.user_avatar} alt={msg.user_name || 'User'} />
              <AvatarFallback className="bg-primary/20 text-primary text-[10px] sm:text-xs font-medium">
                {msg.user_name ? msg.user_name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </AvatarFallback>
            </Avatar>
          ) : (
            isUser ? (
              msg.user_name ? (
                <span className="text-[10px] sm:text-xs font-medium">{msg.user_name.charAt(0).toUpperCase()}</span>
              ) : (
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )
            ) : (
              <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            )
          )}
        </div>
        
        {/* Message Content */}
        <div className={cn(
          "flex flex-col max-w-[80%] sm:max-w-[70%]",
          isUser ? "items-start" : "items-end"
        )}>
          <span className={cn(
            "text-[10px] sm:text-xs text-muted-foreground mb-0.5 sm:mb-1",
            isUser ? "text-left" : "text-right"
          )}>
            {msg.user_name && <span className="mr-1 sm:mr-2">{msg.user_name}</span>}
            {formatTime(msg.timestamp)}
          </span>
          <div className={cn(
            "px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl text-sm",
            isUser
              ? "bg-primary text-primary-foreground rounded-tl-none"
              : "bg-muted rounded-tr-none"
          )}>
            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-fill flex glass-card">
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[inherit]">
    {/* Left Sidebar - Session List */}
    <div className={cn(
      "border-r border-border/40 flex flex-col shrink-0",
      "w-full absolute inset-0 z-10 sm:relative sm:w-72 md:w-80 lg:w-[340px]",
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
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
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
            <div className="p-1.5 sm:p-2 pr-2.5 sm:pr-3 space-y-1">
              {filteredSessions.map((session) => {
                const isSelected = selectedSession?.session.session_id === session.session_id;
                const displayId = getSessionDisplayId(session);
                const botId = getBotId(session);
                const isGroup = session.type === 'group';
                const userAvatar = session.last_user?.user_avatar;
                
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
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      {/* Avatar */}
                      <Avatar className="w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                        {!isGroup && userAvatar && (
                          <AvatarImage src={userAvatar} alt={displayId} />
                        )}
                        <AvatarFallback className={cn(
                          isGroup ? "bg-green-500/20" : "bg-blue-500/20"
                        )}>
                          {isGroup ? (
                            <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                          ) : (
                            <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* First row: ID and Bot Badge */}
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-sm truncate" title={displayId}>
                            {displayId}
                          </div>
                          {botId !== '0' && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-orange-500/20 text-orange-600 border-orange-500/30">
                              Bot {botId}
                            </Badge>
                          )}
                        </div>
                        {/* Second row: Last user message preview */}
                        {session.last_user?.message && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {session.last_user.user_name && (
                              <span className="font-medium text-foreground/70">{session.last_user.user_name}: </span>
                            )}
                            {session.last_user.message}
                          </p>
                        )}
                        {/* Third row: Badge and Stats */}
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
                
                <Avatar key={selectedSession.session.session_id} className="w-8 h-8 sm:w-10 sm:h-10 shrink-0">
                  {selectedSession.session.type !== 'group' && selectedSession.session.last_user?.user_avatar && (
                    <AvatarImage src={selectedSession.session.last_user.user_avatar} alt={getSessionDisplayId(selectedSession.session)} />
                  )}
                  <AvatarFallback className={cn(
                    selectedSession.session.type === 'group' ? "bg-green-500/20" : "bg-blue-500/20"
                  )}>
                    {selectedSession.session.type === 'group' ? (
                      <Users className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                    ) : (
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                    )}
                  </AvatarFallback>
                </Avatar>
                
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-sm sm:text-base truncate">
                      {getSessionDisplayId(selectedSession.session)}
                    </h2>
                    {getBotId(selectedSession.session) !== '0' && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0 bg-orange-500/20 text-orange-600 border-orange-500/30">
                        Bot {getBotId(selectedSession.session)}
                      </Badge>
                    )}
                  </div>
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
                    <ScrollArea ref={chatScrollRef} className="flex-1 p-4">
                      <div className="space-y-2">
                        {getChatMessages().length > 0 ? (
                          getChatMessages().map((msg, idx) => renderChatMessage(msg, idx))
                        ) : (
                          <div className="text-center text-muted-foreground py-12">
                            <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>{t('sessionManagement.noHistory')}</p>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </ScrollArea>
                    
                    {/* Send Message Area */}
                    <div className={cn(
                      "p-2 sm:p-4 border-t",
                      isGlass ? "border-white/10 bg-background/30" : "border-border bg-muted/30"
                    )}>
                      <div
                        className={cn(
                          "max-w-4xl mx-auto space-y-2 rounded-xl border border-dashed p-2 transition-colors",
                          isDraggingImages ? "border-primary bg-primary/10" : "border-transparent"
                        )}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDraggingImages(true);
                        }}
                        onDragLeave={() => setIsDraggingImages(false)}
                        onDrop={handleDropImages}
                      >
                        {pendingImages.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {pendingImages.map((image) => (
                              <div key={image.id} className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted">
                                <img src={image.previewUrl} alt={image.file.name} className="w-full h-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => removePendingImage(image.id)}
                                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/90 text-foreground flex items-center justify-center opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                                  title={t('sessionManagement.removeImage')}
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex items-end gap-2">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files) addImageFiles(e.target.files);
                              e.target.value = '';
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={isSending}
                            onClick={() => fileInputRef.current?.click()}
                            className="h-11 w-11 shrink-0 rounded-lg"
                            title={t('sessionManagement.selectImages')}
                          >
                            <ImageIcon className="w-4 h-4" />
                          </Button>
                          <Textarea
                            placeholder={t('sessionManagement.inputPlaceholder')}
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onPaste={handlePasteImages}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                e.preventDefault();
                                handleSendMessage();
                              }
                            }}
                            disabled={isSending}
                            className={cn("flex-1 min-h-[44px] max-h-28 text-sm rounded-lg resize-none", isGlass && "glass-card")}
                          />
                          <Button
                            size="icon"
                            disabled={isSending || (!messageText.trim() && pendingImages.length === 0)}
                            onClick={handleSendMessage}
                            className="h-11 w-11 shrink-0 rounded-lg"
                            title={t('sessionManagement.send')}
                          >
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </Button>
                        </div>
                        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Upload className="w-3 h-3" />
                            {t('sessionManagement.sendHint')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  // Text Mode
                  <ScrollArea ref={textScrollRef} className="flex-1 p-4">
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
