import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const DEFAULT_SELECT_VALUE = '__all__';

import {
  History,
  Loader2,
  RefreshCw,
  Search,
  FileText,
  Database,
  Clock,
  User,
  Bot,
  Wrench,
  MessageSquare,
  CheckCircle,
  Lightbulb,
  Shield,
  XOctagon,
  GitBranch,
  ChevronDown,
  ChevronUp,
  Filter,
  Radio,
  FileCheck,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  Cpu,
  Download,
  Users,
} from 'lucide-react';
import {
  aiSessionLogsApi,
  aiToolsApi,
  personaApi,
  SessionLogSummary,
  SessionLogDetail,
  SessionLogEntry,
  SessionLogEntryType,
  SessionLogStatsOverview,
  SessionLogCategory,
  LinkedAgent,
} from '@/lib/api';
import { toast } from 'sonner';

// ============================================================================
// 工具函数
// ============================================================================

function formatTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatTimeOnly(ts: number): string {
  const date = new Date(ts * 1000);
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getEntryTypeLabel(type: SessionLogEntryType, t: (key: string) => string): string {
  const map: Record<string, string> = {
    session_created: t('aiHistory.entryType.sessionCreated'),
    session_resumed: t('aiHistory.entryType.sessionResumed') || '会话续写',
    session_ended: t('aiHistory.entryType.sessionEnded'),
    system_prompt: t('aiHistory.entryType.systemPrompt'),
    run_start: t('aiHistory.entryType.runStart'),
    run_end: t('aiHistory.entryType.runEnd'),
    user_input: t('aiHistory.entryType.userInput'),
    thinking: t('aiHistory.entryType.thinking'),
    tool_call: t('aiHistory.entryType.toolCall'),
    tool_return: t('aiHistory.entryType.toolReturn'),
    text_output: t('aiHistory.entryType.textOutput'),
    result: t('aiHistory.entryType.result'),
    token_usage: t('aiHistory.entryType.tokenUsage'),
    error: t('aiHistory.entryType.error'),
    node_transition: t('aiHistory.entryType.nodeTransition'),
    agent_linked: t('aiHistory.entryType.agentLinked') || '子Agent',
    tools_list: t('aiHistory.entryType.toolsList') || '工具列表',
    proactive_emission: t('aiHistory.entryType.proactiveEmission') || '主动发言',
  };
  return map[type] || type;
}

function getEntryTypeIcon(type: SessionLogEntryType) {
  switch (type) {
    case 'session_created': return <Clock className="w-4 h-4" />;
    case 'session_resumed': return <Clock className="w-4 h-4" />;
    case 'session_ended': return <CheckCircle className="w-4 h-4" />;
    case 'system_prompt': return <Shield className="w-4 h-4" />;
    case 'run_start': return <Clock className="w-4 h-4" />;
    case 'run_end': return <CheckCircle className="w-4 h-4" />;
    case 'user_input': return <MessageSquare className="w-4 h-4" />;
    case 'thinking': return <Lightbulb className="w-4 h-4" />;
    case 'tool_call': return <Wrench className="w-4 h-4" />;
    case 'tool_return': return <CheckCircle className="w-4 h-4" />;
    case 'text_output': return <MessageSquare className="w-4 h-4" />;
    case 'result': return <CheckCircle className="w-4 h-4" />;
    case 'token_usage': return <BarChart3 className="w-4 h-4" />;
    case 'error': return <XOctagon className="w-4 h-4" />;
    case 'node_transition': return <GitBranch className="w-4 h-4" />;
    case 'agent_linked': return <Bot className="w-4 h-4" />;
    case 'tools_list': return <Wrench className="w-4 h-4" />;
    case 'proactive_emission': return <MessageSquare className="w-4 h-4" />;
    default: return <FileText className="w-4 h-4" />;
  }
}

function getEntryTypeColor(type: SessionLogEntryType): string {
  switch (type) {
    case 'user_input': return 'text-primary';
    case 'text_output': return 'text-indigo-500';
    case 'thinking': return 'text-amber-500';
    case 'tool_call': return 'text-orange-500';
    case 'tool_return': return 'text-teal-500';
    case 'error': return 'text-red-500';
    case 'token_usage': return 'text-cyan-500';
    case 'system_prompt': return 'text-purple-500';
    case 'node_transition': return 'text-pink-500';
    case 'agent_linked': return 'text-violet-500';
    case 'tools_list': return 'text-cyan-500';
    case 'proactive_emission': return 'text-pink-400';
    default: return 'text-muted-foreground';
  }
}

// 解析 session_id，提取显示名称和聊天类型
// 格式: web:web:web-client-001:group:group_xxx 或 web:web:web-client-001:private:user_xxx
function parseSessionId(sessionId: string | null | undefined): { displayName: string; chatType: 'group' | 'private' | null } {
  if (!sessionId) return { displayName: '', chatType: null };
  const parts = sessionId.split(':');
  if (parts.length >= 5) {
    const type = parts[3];
    const name = parts[4];
    if (type === 'group') {
      return { displayName: name, chatType: 'group' };
    }
    if (type === 'private') {
      return { displayName: name, chatType: 'private' };
    }
  }
  return { displayName: sessionId, chatType: null };
}

// 工具徽章组件 - 显示工具名称和描述
function ToolBadge({ toolName }: { toolName: string }) {
  const [details, setDetails] = useState<{ description?: string; plugin?: string } | null>(null);

  useEffect(() => {
    let mounted = true;
    aiToolsApi.getToolDetail(toolName).then(res => {
      if (mounted && res) {
        setDetails({ description: res.description, plugin: res.plugin });
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [toolName]);

  const tooltipContent = details
    ? `${details.plugin ? `[${details.plugin}] ` : ''}${details.description || toolName}`
    : toolName;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5 cursor-help">
          {toolName}
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p className="text-xs font-mono">{tooltipContent}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function hasEntryContent(entry: SessionLogEntry): boolean {
  const { type, data } = entry;
  switch (type) {
    case 'user_input':
      return !!(data.content || data.user_message);
    case 'text_output':
      return !!(data.content || data.output);
    case 'thinking':
      return !!data.content;
    case 'tool_call':
      return true;
    case 'tool_return':
      return !!data.content;
    case 'token_usage':
      return true;
    case 'error':
      return !!(data.error_type || data.message);
    case 'node_transition':
      return !!data.node_type;
    case 'system_prompt':
      return !!data.content;
    case 'tools_list':
      return !!(data.tools && (data.tools as unknown[]).length > 0);
    case 'agent_linked':
      return true;
    case 'proactive_emission':
      return !!data.content;
    case 'session_created':
    case 'session_resumed':
    case 'session_ended':
    case 'run_start':
    case 'run_end':
    case 'result':
      return false;
    default:
      return false;
  }
}

// ============================================================================
// 详情页时间线组件
// ============================================================================

function TimelineNode({ type, isLast }: { type: SessionLogEntryType; isLast: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      {!isLast && (
        <div className="absolute top-[16px] left-1/2 -translate-x-1/2 w-px h-[calc(100%+14px)] bg-border/50" />
      )}
      <div className={cn("shrink-0 z-10", getEntryTypeColor(type))}>
        {getEntryTypeIcon(type)}
      </div>
    </div>
  );
}

function EntryContent({ entry, t }: { entry: SessionLogEntry; t: (key: string) => string }) {
  const { type, data } = entry;

  if (type === 'error') {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium text-red-600">{data.error_type as string}</p>
        <p className="text-sm text-red-500/80">{data.message as string}</p>
      </div>
    );
  }

  if (type === 'tool_call') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Wrench className="w-3.5 h-3.5 text-orange-500" />
          <span className="text-sm font-medium">{data.tool_name as string}</span>
          <span className="text-xs text-muted-foreground font-mono">{data.tool_call_id as string}</span>
        </div>
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto font-mono">
          {data.args as string}
        </pre>
      </div>
    );
  }

  if (type === 'tool_return') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <CheckCircle className="w-3.5 h-3.5 text-teal-500" />
          <span className="text-sm font-medium">{data.tool_name as string}</span>
        </div>
        <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto font-mono whitespace-pre-wrap">
          {data.content as string}
        </pre>
      </div>
    );
  }

  if (type === 'node_transition') {
    return (
      <div className="flex items-center gap-2 text-sm">
        <GitBranch className="w-3.5 h-3.5 text-pink-500" />
        <span className="font-medium">{data.node_type as string}</span>
      </div>
    );
  }

  if (type === 'tools_list') {
    const tools = data.tools as string[];
    return (
      <TooltipProvider delayDuration={300}>
        <div className="flex flex-wrap gap-1">
          {tools.map((tool, index) => (
            <ToolBadge key={index} toolName={tool} />
          ))}
        </div>
      </TooltipProvider>
    );
  }

  if (type === 'system_prompt') {
    return (
      <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
        {data.content as string}
      </pre>
    );
  }

  if (type === 'thinking') {
    return (
      <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto whitespace-pre-wrap font-mono italic text-muted-foreground max-h-48 overflow-y-auto">
        {data.content as string}
      </pre>
    );
  }

  if (type === 'proactive_emission') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] text-muted-foreground">来源: {(data.source as string) || '-'}</span>
          {data.trigger_reason && (
            <span className="text-[10px] text-muted-foreground/70">触发: {data.trigger_reason as string}</span>
          )}
        </div>
        <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{data.content as string}</pre>
      </div>
    );
  }

  const content = (data.content || data.output || data.user_message || '') as string;
  return (
    <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{content}</pre>
  );
}

function TimelineEntry({ entry, t, personaName, isLast, onAgentLinkedClick }: {
  entry: SessionLogEntry;
  t: (key: string) => string;
  personaName: string;
  isLast: boolean;
  onAgentLinkedClick?: (agent: LinkedAgent) => void;
}) {
  const type = entry.type;
  const label = getEntryTypeLabel(type, t);
  const time = formatTimeOnly(entry.timestamp);
  const hasContent = hasEntryContent(entry);

  // 用户消息
  if (type === 'user_input') {
    const content = (entry.data.content || entry.data.user_message || '') as string;
    return (
      <div className="flex gap-3">
        <TimelineNode type={type} isLast={isLast} />
        <div className="flex-1 min-w-0 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-primary">{t('aiHistory.entryType.userInput')}</span>
            <span className="text-[10px] text-muted-foreground">{time}</span>
          </div>
          <div className="bg-primary text-primary-foreground rounded-2xl rounded-tl-sm px-3 py-2 sm:px-4 sm:py-2.5 text-sm shadow-sm block sm:inline-block sm:max-w-[85%] overflow-hidden">
            <pre className="whitespace-pre-wrap font-sans leading-relaxed break-words [overflow-wrap:anywhere]">{content}</pre>
          </div>
        </div>
      </div>
    );
  }

  // AI 消息
  if (type === 'text_output') {
    const content = (entry.data.content || entry.data.output || '') as string;
    const avatarUrl = personaName ? personaApi.getAvatarUrl(personaName) : '';
    return (
      <div className="flex gap-3">
        <TimelineNode type={type} isLast={isLast} />
        <div className="flex-1 min-w-0 pb-5">
          <div className="flex items-center gap-2 mb-1">
            <Avatar className="w-5 h-5">
              <AvatarImage src={avatarUrl} alt={personaName} />
              <AvatarFallback className="bg-indigo-500/10 text-indigo-600">
                <Bot className="w-3.5 h-3.5" />
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium text-indigo-600">{personaName}</span>
            <span className="text-[10px] text-muted-foreground">{time}</span>
          </div>
          <div className="bg-muted rounded-2xl rounded-tl-sm px-3 py-2 sm:px-4 sm:py-2.5 text-sm shadow-sm border border-border/50 block sm:inline-block sm:max-w-[85%] overflow-hidden">
            {content ? (
              <pre className="whitespace-pre-wrap font-sans leading-relaxed break-words [overflow-wrap:anywhere]">{content}</pre>
            ) : (
              <p className="italic text-muted-foreground/60">Agent没有任何回应</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // token_usage - Badge 形式不展开
  if (type === 'token_usage') {
    return (
      <div className="flex gap-3">
        <TimelineNode type={type} isLast={isLast} />
        <div className="flex-1 min-w-0 pb-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">{label}</span>
            <span className="text-[10px] text-muted-foreground/50">{time}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1">
              {entry.data.model_name as string}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {t('aiHistory.inputTokens')}: {entry.data.input_tokens as number}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-4 px-1">
              {t('aiHistory.outputTokens')}: {entry.data.output_tokens as number}
            </Badge>
          </div>
        </div>
      </div>
    );
  }

  // agent_linked 特殊处理 - 只显示 sub_agent 类型的可点击按钮
  if (type === 'agent_linked') {
    const agentData = entry.data as {
      agent_type: string;
      session_id: string;
      session_uuid: string;
      persona_name: string | null;
      create_by: string | null;
      log_file: string | null;
      linked_at: number;
    };
    
    // 只有 sub_agent 类型才显示可点击按钮，其他类型隐藏
    if (agentData.agent_type !== 'sub_agent') {
      return null;
    }
    
    // 创建一个临时的 LinkedAgent 对象用于点击
    const linkedAgent: LinkedAgent = {
      agent_type: agentData.agent_type,
      session_id: agentData.session_id,
      session_uuid: agentData.session_uuid,
      persona_name: agentData.persona_name,
      create_by: agentData.create_by || '',
      log_file: agentData.log_file || null,
      linked_at: agentData.linked_at,
      entry_count: 0,
      type_counts: {},
      is_active: null,
      source: 'unavailable',
    };
    return (
      <div className="flex gap-3">
        <TimelineNode type={type} isLast={isLast} />
        <div className="flex-1 min-w-0 pb-5">
          <button
            onClick={() => onAgentLinkedClick?.(linkedAgent)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors w-full",
              "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20",
              "text-violet-600"
            )}
          >
            <Bot className="w-4 h-4" />
            <span className="font-medium">查看子Agent详情</span>
            <span className="text-violet-400/70 ml-auto truncate max-w-[120px]">{parseSessionId(agentData.session_id).displayName}</span>
            <ChevronRight className="w-3 h-3 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  // 可折叠系统消息
  const collapsibleTypes = ['thinking', 'tool_call', 'tool_return', 'system_prompt', 'error', 'tools_list', 'proactive_emission'];
  const isCollapsible = collapsibleTypes.includes(type);

  if (isCollapsible && hasContent) {
    return <CollapsibleSystemEntry entry={entry} t={t} isLast={isLast} />;
  }

  // 纯标签系统消息
  return (
    <div className="flex gap-3">
      <TimelineNode type={type} isLast={isLast} />
      <div className="flex-1 min-w-0 pb-5">
        <div className={cn(
          "flex items-center gap-1.5 text-[11px]",
          type === 'node_transition' ? "text-muted-foreground/30" : "text-muted-foreground"
        )}>
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground/50">{time}</span>
        </div>
      </div>
    </div>
  );
}

function CollapsibleSystemEntry({ entry, t, isLast }: {
  entry: SessionLogEntry;
  t: (key: string) => string;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(false);
  const type = entry.type;
  const label = getEntryTypeLabel(type, t);
  const time = formatTimeOnly(entry.timestamp);

  return (
    <div className="flex gap-3">
      <TimelineNode type={type} isLast={isLast} />
      <div className="flex-1 min-w-0 pb-5">
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-1.5 text-[11px] transition-colors",
            type === 'node_transition' ? "text-muted-foreground/30 hover:text-muted-foreground/60" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className={cn("font-medium", type === 'error' && "text-red-500")}>{label}</span>
          <span className="text-muted-foreground/50">{time}</span>
          {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {open && (
          <div className="mt-1.5 bg-muted/30 rounded-lg p-3 text-sm">
            <EntryContent entry={entry} t={t} />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// 主组件
// ============================================================================

export default function AIHistoryPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 数据状态
  const [logs, setLogs] = useState<SessionLogSummary[]>([]);
  const [stats, setStats] = useState<SessionLogStatsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [categories, setCategories] = useState<SessionLogCategory[]>([]);

  // 选中的详情
  const [selectedLog, setSelectedLog] = useState<SessionLogSummary | null>(null);
  const [detail, setDetail] = useState<SessionLogDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 选中的子Agent详情
  const [selectedLinkedAgent, setSelectedLinkedAgent] = useState<LinkedAgent | null>(null);
  const [linkedAgentDetail, setLinkedAgentDetail] = useState<SessionLogDetail | null>(null);
  const [isLoadingLinkedAgentDetail, setIsLoadingLinkedAgentDetail] = useState(false);

  // 工具详情缓存
  const [toolDetailsCache, setToolDetailsCache] = useState<Record<string, { description?: string; plugin?: string }>>({});

  // 获取工具详情
  const fetchToolDetail = useCallback(async (toolName: string) => {
    if (toolDetailsCache[toolName]) {
      return toolDetailsCache[toolName];
    }
    try {
      const res = await aiToolsApi.getToolDetail(toolName);
      if (res) {
        const details = { description: res.description, plugin: res.plugin };
        setToolDetailsCache(prev => ({ ...prev, [toolName]: details }));
        return details;
      }
    } catch (e) {
      console.error('Failed to fetch tool detail:', e);
    }
    return {};
  }, [toolDetailsCache]);

  // 筛选
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCreateBy, setFilterCreateBy] = useState<string>('Chat');
  const [filterPersona, setFilterPersona] = useState<string>(DEFAULT_SELECT_VALUE);
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  // 分页
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 50;

  // 获取统计
  const fetchStats = useCallback(async () => {
    try {
      setIsLoadingStats(true);
      const data = await aiSessionLogsApi.getStatsOverview();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch session log stats:', err);
    } finally {
      setIsLoadingStats(false);
    }
  }, []);

  // 获取分类列表（后端聚合）
  const fetchCategories = useCallback(async () => {
    try {
      const data = await aiSessionLogsApi.getCategories();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Failed to fetch session log categories:', err);
    }
  }, []);

  // 获取统一日志列表
  const fetchLogs = useCallback(async (currentOffset: number = 0) => {
    try {
      setIsLoading(true);
      const data = await aiSessionLogsApi.getLogs({
        session_id: searchQuery || undefined,
        create_by: filterCreateBy !== DEFAULT_SELECT_VALUE ? filterCreateBy : undefined,
        persona_name: filterPersona !== DEFAULT_SELECT_VALUE ? filterPersona : undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
        limit,
        offset: currentOffset,
      });
      setLogs(data.items || []);
      setTotal(data.total || 0);
      setOffset(currentOffset);
    } catch (err) {
      console.error('Failed to fetch session logs:', err);
      toast.error(t('aiHistory.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, filterCreateBy, filterPersona, filterDateFrom, filterDateTo, t]);

  // 获取详情（使用查询参数版 API，避免路径参数中特殊字符导致的路由匹配问题）
  const fetchDetail = useCallback(async (log: SessionLogSummary) => {
    try {
      setIsLoadingDetail(true);
      setSelectedLinkedAgent(null);
      setLinkedAgentDetail(null);
      // 优先使用 file_name 的 stem 作为 session_id（对子 Agent 日志更可靠）
      const sessionId = log.file_name
        ? log.file_name.replace(/\.json$/, '')
        : log.session_id;
      const data = await aiSessionLogsApi.getLogDetail(sessionId, log.session_uuid);
      setDetail(data);
      setSelectedLog(log);
    } catch (err) {
      console.error('Failed to fetch log detail:', err);
      toast.error(t('aiHistory.loadDetailFailed'));
    } finally {
      setIsLoadingDetail(false);
    }
  }, [t]);

  // 生成子Agent的唯一标识键
  const getAgentKey = useCallback((agent: LinkedAgent): string => {
    return `${agent.session_id}:${agent.session_uuid}:${agent.linked_at}`;
  }, []);

  // 获取子Agent详情（优先使用 log_file 的 stem 作为 session_id）
  const fetchLinkedAgentDetail = useCallback(async (agent: LinkedAgent) => {
    try {
      setIsLoadingLinkedAgentDetail(true);
      // 方式1（推荐）：使用 log_file 的 stem 作为 session_id
      const sessionId = agent.log_file
        ? agent.log_file.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
        : agent.session_id;
      const data = await aiSessionLogsApi.getLogDetail(sessionId, agent.session_uuid);
      setLinkedAgentDetail(data);
      setSelectedLinkedAgent(agent);
    } catch (err) {
      console.error('Failed to fetch linked agent detail:', err);
      toast.error(t('aiHistory.loadDetailFailed'));
    } finally {
      setIsLoadingLinkedAgentDetail(false);
    }
  }, [t]);

  // 初始加载
  useEffect(() => {
    fetchStats();
    fetchCategories();
    fetchLogs(0);
  }, [fetchStats, fetchCategories, fetchLogs]);

  // 刷新
  const handleRefresh = useCallback(() => {
    fetchStats();
    fetchCategories();
    fetchLogs(0);
    if (selectedLog) {
      fetchDetail(selectedLog);
    }
  }, [fetchStats, fetchCategories, fetchLogs, selectedLog, fetchDetail]);

  // 下载当前会话JSON（含子Agent）
  const handleDownloadSession = useCallback(() => {
    if (!detail) return;

    const downloadData = {
      main_session: detail,
      linked_agents: linkedAgentDetail ? [linkedAgentDetail] : [],
    };

    const jsonStr = JSON.stringify(downloadData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${detail.session_id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('会话JSON已保存');
  }, [detail, linkedAgentDetail]);

  // 应用筛选
  const handleApplyFilter = useCallback(() => {
    fetchLogs(0);
  }, [fetchLogs]);

  // 分页
  const handlePrevPage = useCallback(() => {
    if (offset >= limit) {
      fetchLogs(offset - limit);
    }
  }, [offset, limit, fetchLogs]);

  const handleNextPage = useCallback(() => {
    if (offset + limit < total) {
      fetchLogs(offset + limit);
    }
  }, [offset, limit, total, fetchLogs]);

  // 来源和人格列表（来源使用后端 categories 接口，不再从 logs 动态提取）

  const personaOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach(l => set.add(l.persona_name));
    return Array.from(set);
  }, [logs]);

  const handleSelectLog = (log: SessionLogSummary) => {
    fetchDetail(log);
  };

  const handleBackToList = () => {
    setSelectedLog(null);
    setDetail(null);
  };

  const personaName = detail?.persona_name || selectedLog?.persona_name || '';
  const avatarUrl = personaName ? personaApi.getAvatarUrl(personaName) : '';

  return (
    <TooltipProvider>
      <div className="flex-1 overflow-hidden h-full flex">
        {/* 左侧边栏 - 日志列表 */}
      <div className={cn(
        "border-r flex flex-col shrink-0",
        "w-full absolute inset-0 z-10 sm:relative sm:w-80 lg:w-96",
        isGlass ? "border-white/10 glass-card" : "border-border bg-card",
        selectedLog ? "hidden sm:flex" : "flex"
      )}>
        {/* 标题和刷新 */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              {t('aiHistory.title')}
            </h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="h-8 w-8"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* 统计概览 - 带图标 */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-card border rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <HardDrive className="w-7 h-7 text-blue-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">{t('aiHistory.statsTotalFiles')}</p>
                <p className="text-lg font-bold leading-tight mt-0.5">{stats?.disk_count ?? '-'}</p>
              </div>
            </div>
            <div className="bg-card border rounded-xl p-3 flex items-center gap-3 shadow-sm">
              <Cpu className="w-7 h-7 text-green-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground leading-tight">{t('aiHistory.statsActiveSessions')}</p>
                <p className="text-lg font-bold leading-tight mt-0.5">{stats?.memory_count ?? '-'}</p>
              </div>
            </div>
          </div>

          {/* 搜索 */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder={t('aiHistory.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
              className={cn("pl-9 h-8 text-sm", isGlass && "glass-card")}
            />
          </div>

          {/* 筛选 */}
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Select value={filterCreateBy} onValueChange={setFilterCreateBy}>
                <SelectTrigger className="w-[130px] h-7 text-xs">
                  <SelectValue placeholder={t('aiHistory.filterCreateBy')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SELECT_VALUE}>{t('aiHistory.filterAll')}</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.create_by} value={cat.create_by}>
                      {cat.label} ({cat.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPersona} onValueChange={setFilterPersona}>
                <SelectTrigger className="w-[100px] h-7 text-xs">
                  <SelectValue placeholder={t('aiHistory.filterPersona')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DEFAULT_SELECT_VALUE}>{t('aiHistory.filterAll')}</SelectItem>
                  {personaOptions.map((opt) => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleApplyFilter} className="h-7 gap-1 text-xs ml-auto">
                <Filter className="w-3 h-3" />
                {t('common.filter')}
              </Button>
            </div>
          </div>
        </div>

        {/* 日志列表 */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">{t('aiHistory.noLogs')}</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {logs.filter(log => log.session_id).map((log) => {
                const isSelected = selectedLog?.session_uuid === log.session_uuid;
                return (
                  <button
                    key={log.session_uuid}
                    onClick={() => handleSelectLog(log)}
                    className={cn(
                      "w-full p-3 rounded-xl text-left transition-all",
                      "hover:bg-accent/50",
                      isSelected && "bg-primary/10 hover:bg-primary/10 border-l-2 border-primary"
                    )}
                  >
                    <div className="flex items-start gap-3 pt-0.5">
                      {log.is_active ? (
                        <Radio className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
                      ) : (
                        <FileCheck className="w-6 h-6 text-muted-foreground shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-medium truncate">{parseSessionId(log.session_id).displayName}</span>
                          {(() => {
                            const { chatType } = parseSessionId(log.session_id);
                            if (chatType === 'group') {
                              return (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                                  <Users className="w-2.5 h-2.5 mr-0.5" />
                                  {t('aiHistory.chatTypeGroup')}
                                </Badge>
                              );
                            }
                            if (chatType === 'private') {
                              return (
                                <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                                  <User className="w-2.5 h-2.5 mr-0.5" />
                                  {t('aiHistory.chatTypePrivate')}
                                </Badge>
                              );
                            }
                            return null;
                          })()}
                          {log.is_active && (
                            <Badge className="text-[10px] h-4 px-1 bg-green-500/10 text-green-600 border-green-500/20 shrink-0">
                              {t('aiHistory.statusActive')}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-indigo-400" />
                            {log.persona_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            {log.created_at_str}
                          </span>
                          <span className="flex items-center gap-1">
                            <Database className="w-3.5 h-3.5 text-teal-400" />
                            {log.entry_count} {t('aiHistory.entries')}
                          </span>
                        </div>
                        {log.type_counts && Object.keys(log.type_counts).length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {(() => {
                              // 过滤掉的类型
                              const excludedTypes = new Set([
                                'session_created', 'system_prompt', 'run_start',
                                'thinking', 'token_usage', 'error', 'node_transition',
                                'run_end', 'session_ended'
                              ]);
                              
                              // 优先级：result 和 tool_call 置顶，user_input, text_output 置底
                              const priority: Record<string, number> = {
                                result: 1, tool_call: 2,
                                proactive_emission: 3,
                                user_input: 4, text_output: 5,
                              };
                              
                              // 收集需要显示的条目
                              const entries: Array<{ type: string; count: number; isToolCallRatio?: boolean; toolReturn?: number; toolCall?: number }> = [];
                              
                              // 处理 tool_call 和 tool_return
                              const toolCall = (log.type_counts as Record<string, number>)['tool_call'] || 0;
                              const toolReturn = (log.type_counts as Record<string, number>)['tool_return'] || 0;
                              if (toolCall > 0) {
                                entries.push({
                                  type: 'tool_call',
                                  count: toolCall,
                                  isToolCallRatio: true,
                                  toolReturn,
                                  toolCall,
                                });
                              }
                              
                              // 处理其他类型
                              Object.entries(log.type_counts)
                                .filter(([type]) => !excludedTypes.has(type) && type !== 'tool_call' && type !== 'tool_return')
                                .forEach(([type, count]) => {
                                  if (priority[type] !== undefined) {
                                    entries.push({ type, count });
                                  }
                                });
                              
                              // 排序：priority 低的在前
                              entries.sort((a, b) => {
                                const priorityA = priority[a.type] ?? 99;
                                const priorityB = priority[b.type] ?? 99;
                                return priorityA - priorityB;
                              });
                              
                              return (
                                <>
                                  {entries.slice(0, 3).map((entry) => (
                                    <Badge
                                      key={entry.type}
                                      variant="secondary"
                                      className={cn(
                                        "text-[10px] h-4 px-1",
                                        entry.isToolCallRatio && entry.toolReturn !== entry.toolCall && "bg-red-500/20 text-red-400"
                                      )}
                                    >
                                      {entry.isToolCallRatio
                                        ? `工具: ${entry.toolReturn} / ${entry.toolCall}`
                                        : entry.type === 'result' ? `结果: ${entry.count}` :
                                          entry.type === 'user_input' ? `用户: ${entry.count}` :
                                          entry.type === 'text_output' ? `文本: ${entry.count}` :
                                          `${entry.type}: ${entry.count}`
                                      }
                                    </Badge>
                                  ))}
                                  {entries.length > 3 && (
                                    <span className="text-[10px] text-muted-foreground">
                                      +{entries.length - 3}
                                    </span>
                                  )}
                                </>
                              );
                            })()}

                            {/* 显示 linked_agents 数量 */}
                            {log.linked_agent_count > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-violet-500 mt-1">
                                <Bot className="w-3 h-3" />
                                {log.linked_agent_count} 子Agent
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 渲染 linked_agents 子项 */}
                    {log.linked_agents && log.linked_agents.length > 0 && (
                      <div className="pl-11 space-y-1 mt-1">
                        {log.linked_agents.map((agent) => {
                          const agentKey = getAgentKey(agent);
                          const isAgentSelected = selectedLinkedAgent ? getAgentKey(selectedLinkedAgent) === agentKey : false;
                          return (
                            <button
                              key={agentKey}
                              onClick={async (e) => {
                                e.stopPropagation();
                                // Ensure parent log is selected first
                                if (!selectedLog || selectedLog.session_uuid !== log.session_uuid) {
                                  await fetchDetail(log);
                                }
                                fetchLinkedAgentDetail(agent);
                              }}
                              className={cn(
                                "w-full p-2 rounded-lg text-left transition-all text-xs",
                                "hover:bg-violet-500/10",
                                isAgentSelected && "bg-violet-500/20 border-l-2 border-violet-500"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <Bot className="w-4 h-4 text-violet-500 shrink-0" />
                                <span className="font-medium truncate">{parseSessionId(agent.session_id).displayName}</span>
                                <Badge variant="outline" className="text-[10px] h-4 ml-auto">
                                  {agent.create_by}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-muted-foreground text-[10px] pl-6">
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(agent.linked_at)}
                              </div>
                              {/* 显示关联会话的 type_counts */}
                              {agent.type_counts && Object.keys(agent.type_counts).length > 0 && (
                                <div className="flex items-center gap-1 mt-1 flex-wrap pl-6">
                                  {(() => {
                                    const excludedTypes = new Set([
                                      'session_created', 'system_prompt', 'run_start',
                                      'thinking', 'token_usage', 'error', 'node_transition',
                                      'run_end', 'session_ended'
                                    ]);
                                    const priority: Record<string, number> = {
                                      result: 1, tool_call: 2,
                                      user_input: 3, text_output: 4,
                                    };
                                    const entries: Array<{ type: string; count: number; isToolCallRatio?: boolean; toolReturn?: number; toolCall?: number }> = [];
                                    const toolCall = (agent.type_counts as Record<string, number>)['tool_call'] || 0;
                                    const toolReturn = (agent.type_counts as Record<string, number>)['tool_return'] || 0;
                                    if (toolCall > 0) {
                                      entries.push({
                                        type: 'tool_call',
                                        count: toolCall,
                                        isToolCallRatio: true,
                                        toolReturn,
                                        toolCall,
                                      });
                                    }
                                    Object.entries(agent.type_counts)
                                      .filter(([type]) => !excludedTypes.has(type) && type !== 'tool_call' && type !== 'tool_return')
                                      .forEach(([type, count]) => {
                                        if (priority[type] !== undefined) {
                                          entries.push({ type, count });
                                        }
                                      });
                                    entries.sort((a, b) => {
                                      const priorityA = priority[a.type] ?? 99;
                                      const priorityB = priority[b.type] ?? 99;
                                      return priorityA - priorityB;
                                    });
                                    return (
                                      <>
                                        {entries.slice(0, 3).map((entry) => (
                                          <Badge
                                            key={entry.type}
                                            variant="secondary"
                                            className={cn(
                                              "text-[10px] h-4 px-1",
                                              entry.isToolCallRatio && entry.toolReturn !== entry.toolCall && "bg-red-500/20 text-red-400"
                                            )}
                                          >
                                            {entry.isToolCallRatio
                                              ? `工具: ${entry.toolReturn} / ${entry.toolCall}`
                                              : entry.type === 'result' ? `结果: ${entry.count}` :
                                                entry.type === 'user_input' ? `用户: ${entry.count}` :
                                                entry.type === 'text_output' ? `文本: ${entry.count}` :
                                                `${entry.type}: ${entry.count}`
                                            }
                                          </Badge>
                                        ))}
                                        {entries.length > 3 && (
                                          <span className="text-[10px] text-muted-foreground">
                                            +{entries.length - 3}
                                          </span>
                                        )}
                                      </>
                                    );
                                  })()}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* 分页 */}
        {total > 0 && (
          <div className="p-3 border-t border-border/50 flex items-center justify-between text-xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevPage}
              disabled={offset === 0 || isLoading}
              className="h-7 px-2"
            >
              {t('common.previousPage')}
            </Button>
            <span className="text-muted-foreground">
              {t('common.pageInfo', { current: Math.floor(offset / limit) + 1, total: Math.ceil(total / limit) })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextPage}
              disabled={offset + limit >= total || isLoading}
              className="h-7 px-2"
            >
              {t('common.nextPage')}
            </Button>
          </div>
        )}
      </div>

      {/* 右侧内容区 - 详情时间线 */}
      <div className={cn(
        "flex-1 flex flex-col min-w-0 overflow-hidden",
        isGlass ? "bg-background/50 backdrop-blur-md" : "bg-background",
        selectedLog ? "flex" : "hidden sm:flex"
      )}>
        {selectedLog && detail ? (
          <>
            {/* 详情头部 */}
            <div className={cn(
              "h-14 border-b px-4 flex items-center justify-between shrink-0",
              isGlass ? "border-white/10 bg-background/50" : "border-border bg-card"
            )}>
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden h-8 w-8 shrink-0"
                  onClick={handleBackToList}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={avatarUrl} alt={personaName} />
                  <AvatarFallback className="bg-indigo-500/10 text-indigo-600">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h2 className="font-semibold text-sm truncate">{parseSessionId(detail.session_id).displayName}</h2>
                    {(() => {
                      const { chatType } = parseSessionId(detail.session_id);
                      if (chatType === 'group') {
                        return (
                          <Badge variant="secondary" className="text-[10px] h-4 px-1 shrink-0">
                            <Users className="w-2.5 h-2.5 mr-0.5" />
                            {t('aiHistory.chatTypeGroup')}
                          </Badge>
                        );
                      }
                      if (chatType === 'private') {
                        return (
                          <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">
                            <User className="w-2.5 h-2.5 mr-0.5" />
                            {t('aiHistory.chatTypePrivate')}
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {personaName} · {detail.create_by} · {detail.entry_count} {t('aiHistory.entries')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {formatTimestamp(detail.created_at)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefresh}
                  disabled={isLoadingDetail}
                  className="h-8 w-8"
                >
                  {isLoadingDetail ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </Button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleDownloadSession}
                      className="h-8 w-8"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>下载会话JSON</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* 时间线内容 */}
            <ScrollArea className="flex-1">
              <div className="p-4 sm:p-6">
                {/* 显示子Agent详情 */}
                {isLoadingLinkedAgentDetail ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="w-4 h-4 rounded shrink-0 mt-1.5" />
                        <Skeleton className="h-8 rounded-xl w-[60%]" />
                      </div>
                    ))}
                  </div>
                ) : selectedLinkedAgent && linkedAgentDetail ? (
                  <>
                    {/* 子Agent头部 */}
                    <div className="mb-4 p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
                      <div className="flex items-center gap-2">
                        <Bot className="w-5 h-5 text-violet-500" />
                        <span className="font-medium text-sm truncate">子Agent: {parseSessionId(selectedLinkedAgent.session_id).displayName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        UUID: {selectedLinkedAgent.session_uuid} | 创建者: {selectedLinkedAgent.create_by}
                      </div>
                    </div>
                    <div className="space-y-0">
                      {linkedAgentDetail.entries.map((entry, index) => (
                        <TimelineEntry
                          key={`${entry.type}-${entry.timestamp}-${index}`}
                          entry={entry}
                          t={t}
                          personaName={selectedLinkedAgent.persona_name || 'SubAgent'}
                          isLast={index === linkedAgentDetail.entries.length - 1}
                          onAgentLinkedClick={fetchLinkedAgentDetail}
                        />
                      ))}
                    </div>
                  </>
                ) : isLoadingDetail ? (
                  <div className="space-y-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex gap-3">
                        <Skeleton className="w-4 h-4 rounded shrink-0 mt-1.5" />
                        <Skeleton className="h-8 rounded-xl w-[60%]" />
                      </div>
                    ))}
                  </div>
                ) : detail.entries.length > 0 ? (
                  <div className="space-y-0">
                    {detail.entries.map((entry, index) => (
                      <TimelineEntry
                        key={`${entry.type}-${entry.timestamp}-${index}`}
                        entry={entry}
                        t={t}
                        personaName={personaName}
                        isLast={index === detail.entries.length - 1}
                        onAgentLinkedClick={fetchLinkedAgentDetail}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="w-10 h-10 mb-3 opacity-40" />
                    <p className="text-sm">{t('aiHistory.noEntries')}</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          /* 空状态 */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <History className="w-12 h-12 mb-4 opacity-20" />
            <p className="text-sm">{t('aiHistory.selectSession')}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">点击左侧会话查看详情</p>
          </div>
        )}
      </div>
      </div>
    </TooltipProvider>
  );
}
