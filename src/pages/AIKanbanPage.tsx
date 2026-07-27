import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  Download,
  Eye,
  FileCode2,
  FileImage,
  FileText,
  Loader2,
  MoreHorizontal,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import {
  aiKanbanApi,
  getApiErrorMessage,
  type AIArtifactItem,
  type AIKanbanArtifactBrief,
  type AIKanbanBoardResponse,
  type AIKanbanCapabilityCandidate,
  type AIKanbanCard,
  type AIKanbanColumnKey,
  type AIKanbanEvaluateMeshResponse,
  type AIKanbanTaskDetail,
  type AIWorkspaceFile,
} from '@/lib/api';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import StateStoreViewer, { StateStoreViewerHandle } from '@/components/StateStoreViewer';

const COLUMN_KEYS: AIKanbanColumnKey[] = ['target', 'progress', 'Done', 'Blocked', 'failed'];
const ALL_VALUE = '__all__';

interface PendingAction {
  type: 'pause' | 'resume' | 'fail' | 'respawn' | 'approve' | 'reject' | 'deleteArtifact' | 'hardDelete';
  task?: AIKanbanCard;
  artifact?: AIArtifactItem;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}

type BulkDeleteCategory = 'all' | 'completed' | 'failed' | 'running' | 'pending' | 'paused' | 'waiting_approval' | 'cancelled';
type BulkDeleteStatus = Exclude<BulkDeleteCategory, 'all'>;

const BULK_DELETE_STATUS_OPTIONS: BulkDeleteCategory[] = ['all', 'completed', 'failed', 'running', 'pending', 'paused', 'waiting_approval', 'cancelled'];
const BULK_DELETE_API_STATUSES: BulkDeleteStatus[] = ['completed', 'failed', 'running', 'pending', 'paused', 'waiting_approval', 'cancelled'];

// 看板列 → 批量硬删除 API 的 status 参数（与后端列归类一致；一列可对应多状态）
const COLUMN_TO_BULK_STATUSES: Record<AIKanbanColumnKey, BulkDeleteStatus[]> = {
  target: ['pending'],
  progress: ['running'],
  Done: ['completed'],
  Blocked: ['paused', 'waiting_approval'],
  failed: ['failed', 'cancelled'],
};

interface CreateSubtaskDraft {
  description: string;
  agent_profile: string;
  depends_on: string;
}

interface FilePreviewState {
  kind: 'text' | 'image' | 'unsupported';
  content: string;
  objectUrl?: string;
}

const emptyColumns: Record<AIKanbanColumnKey, AIKanbanCard[]> = {
  target: [],
  progress: [],
  Done: [],
  Blocked: [],
  failed: [],
};

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatBytes(size?: number): string {
  if (!size) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function shortId(id?: string | null): string {
  if (!id) return '-';
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function getBasename(path?: string | null): string {
  if (!path) return '';
  return path.split(/[\\/]/).filter(Boolean).pop() || '';
}

function extensionFromMime(mime?: string | null): string {
  if (!mime) return '';
  const normalized = mime.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
    'text/plain': '.txt',
    'text/markdown': '.md',
    'text/x-python': '.py',
    'text/x-patch': '.patch',
    'application/json': '.json',
    'text/html': '.html',
    'text/css': '.css',
    'application/javascript': '.js',
    'text/javascript': '.js',
  };
  return map[normalized] || '';
}

function getArtifactFilename(artifact: AIArtifactItem | AIKanbanArtifactBrief): string {
  const payloadPath = 'payload_path' in artifact ? artifact.payload_path : '';
  const base = getBasename(payloadPath) || getBasename(artifact.summary) || shortId(artifact.id);
  if (base.includes('.')) return base;
  return `${base}${extensionFromMime(artifact.mime)}`;
}

function isImageFile(mime?: string | null, filename?: string | null): boolean {
  const normalized = mime?.split(';')[0].trim().toLowerCase() || '';
  return normalized.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|ico|avif)$/i.test(filename || '');
}

function isTextFile(mime?: string | null, filename?: string | null): boolean {
  const normalized = mime?.split(';')[0].trim().toLowerCase() || '';
  return normalized.startsWith('text/')
    || ['application/json', 'application/xml', 'application/javascript', 'application/typescript'].includes(normalized)
    || /\.(txt|md|json|ya?ml|xml|html?|css|js|jsx|ts|tsx|py|java|c|cc|cpp|h|hpp|cs|go|rs|php|rb|sh|bat|cmd|ps1|sql|toml|ini|env|log|patch|diff)$/i.test(filename || '');
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (['completed', 'skipped', 'done', 'success'].includes(normalized)) return 'bg-green-500/15 text-green-600 border-green-500/30';
  if (['running', 'processing', 'active'].includes(normalized)) return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  if (['failed', 'cancelled', 'error'].includes(normalized)) return 'bg-red-500/15 text-red-600 border-red-500/30';
  if (['paused', 'waiting_approval', 'blocked'].includes(normalized)) return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border/50';
}

// Returns a Tailwind class for the per-column colored border stroke.
// Card surface (glassmorphism vs solid) and transparency are handled by
// the global `glass-card` style and the `--card-opacity` CSS variable so
// every column follows the active theme.
function columnAccentClass(column: AIKanbanColumnKey) {
  if (column === 'target') return 'border-slate-500/40 dark:border-slate-400/30';
  if (column === 'progress') return 'border-blue-500/40 dark:border-blue-400/30';
  if (column === 'Done') return 'border-green-500/40 dark:border-green-400/30';
  if (column === 'Blocked') return 'border-amber-500/40 dark:border-amber-400/30';
  return 'border-red-500/40 dark:border-red-400/30';
}

// 列头视觉：每个类目一个小图标 + 专属颜色（标题与数字 badge 同色系，与列边框色呼应）
const COLUMN_HEADER_META: Record<AIKanbanColumnKey, {
  Icon: typeof ClipboardList;
  titleClass: string;
  badgeClass: string;
}> = {
  target: {
    Icon: Rocket,
    titleClass: 'text-slate-600 dark:text-slate-300',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  },
  progress: {
    Icon: PlayCircle,
    titleClass: 'text-blue-600 dark:text-blue-400',
    badgeClass: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  Done: {
    Icon: CheckCircle2,
    titleClass: 'text-green-600 dark:text-green-400',
    badgeClass: 'bg-green-500/15 text-green-600 dark:text-green-400',
  },
  Blocked: {
    Icon: PauseCircle,
    titleClass: 'text-amber-600 dark:text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  failed: {
    Icon: XCircle,
    titleClass: 'text-red-600 dark:text-red-400',
    badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400',
  },
};

function logClass(eventType: string) {
  const lower = eventType.toLowerCase();
  if (['workspace_violation', 'approval', 'step_failed', 'failed', 'error'].some((key) => lower.includes(key))) {
    return 'border-red-500/30 bg-red-500/10';
  }
  if (['plan_created', 'step_done', 'completed', 'success'].some((key) => lower.includes(key))) {
    return 'border-green-500/30 bg-green-500/10';
  }
  return 'border-border/50 bg-muted/20';
}

export default function AIKanbanPage() {
  const { t } = useLanguage();
  const { style, cardOpacity, blurIntensity } = useTheme();
  const isGlass = style === 'glassmorphism';
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const stateStoreRef = useRef<StateStoreViewerHandle>(null);
  /** 第一层确认 → 第二层确认 时跳过清列状态 */
  const bulkDeleteAdvancingRef = useRef(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'data'>('kanban');
  const [stateStoreSelectedCount, setStateStoreSelectedCount] = useState(0);

  const [board, setBoard] = useState<AIKanbanBoardResponse>({ columns: emptyColumns, summary: { task_count: 0, subtask_count: 0, updated_at: null } });
  const [candidates, setCandidates] = useState<AIKanbanCapabilityCandidate[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AIKanbanTaskDetail | null>(null);
  const [artifacts, setArtifacts] = useState<AIArtifactItem[]>([]);
  const [workspaceFiles, setWorkspaceFiles] = useState<AIWorkspaceFile[]>([]);
  const [artifactPreview, setArtifactPreview] = useState<Record<string, FilePreviewState>>({});
  const [workspacePreview, setWorkspacePreview] = useState<Record<string, FilePreviewState>>({});
  const artifactPreviewRef = useRef<Record<string, FilePreviewState>>({});
  const workspacePreviewRef = useRef<Record<string, FilePreviewState>>({});
  const [detailTab, setDetailTab] = useState('subtasks');
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [includeChildren, setIncludeChildren] = useState(true);
  const [filters, setFilters] = useState({ scope_key: '', bot_id: '', group_id: '', owner_user_id: '', status: ALL_VALUE });
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [secondConfirmAction, setSecondConfirmAction] = useState<PendingAction | null>(null);
  const [isActing, setIsActing] = useState(false);
  const [failReason, setFailReason] = useState('');
  const [respawnDraft, setRespawnDraft] = useState({ description: '', agent_profile: '' });
  const [approvalNote, setApprovalNote] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState({ goal: '', persona_name: '早柚', bot_id: '', owner_user_id: '', interval_hours: 0 });
  const [subtasks, setSubtasks] = useState<CreateSubtaskDraft[]>([
    { description: '', agent_profile: '', depends_on: '' },
    { description: '', agent_profile: '', depends_on: '0' },
  ]);
  const [evaluateOpen, setEvaluateOpen] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluateDraft, setEvaluateDraft] = useState({ user_goal: '', owner_user_id: 'user_web_01', persona_name: '早柚' });
  const [evaluateResult, setEvaluateResult] = useState<AIKanbanEvaluateMeshResponse | null>(null);
  const [patchOpen, setPatchOpen] = useState(false);
  const [patchDraft, setPatchDraft] = useState({ summary: '', patch_text: '' });
  const [isSubmittingPatch, setIsSubmittingPatch] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleteSecondConfirmOpen, setBulkDeleteSecondConfirmOpen] = useState(false);
  const [bulkDeleteCategory, setBulkDeleteCategory] = useState<BulkDeleteCategory>('all');
  /** 从列头发起时锁定列；从页顶发起时为 null（手动选分类） */
  const [bulkDeleteColumn, setBulkDeleteColumn] = useState<AIKanbanColumnKey | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const loadBoard = useCallback(async () => {
    try {
      setIsLoadingBoard(true);
      const data = await aiKanbanApi.getBoard({
        scope_key: filters.scope_key.trim() || undefined,
        bot_id: filters.bot_id.trim() || undefined,
        group_id: filters.group_id.trim() || undefined,
        owner_user_id: filters.owner_user_id.trim() || undefined,
        include_children: includeChildren,
        status: filters.status === ALL_VALUE ? undefined : filters.status,
      });
      setBoard({ columns: { ...emptyColumns, ...data.columns }, summary: data.summary });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.loadBoardFailed'));
    } finally {
      setIsLoadingBoard(false);
    }
  }, [filters, includeChildren, t]);

  const loadCandidates = useCallback(async () => {
    try {
      const data = await aiKanbanApi.getCandidates();
      setCandidates(data.items || []);
    } catch {
      setCandidates([]);
    }
  }, []);

  const loadTaskDetail = useCallback(async (taskId: string) => {
    try {
      setIsLoadingDetail(true);
      setDetailTab('subtasks');
      setArtifactPreview((prev) => {
        Object.values(prev).forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
        return {};
      });
      setWorkspacePreview((prev) => {
        Object.values(prev).forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
        return {};
      });
      const data = await aiKanbanApi.getTaskDetail(taskId, 200);
      setDetail(data);
      const artifactData = await aiKanbanApi.getArtifacts({ root_task_id: data.root?.id || data.task.root_task_id });
      setArtifacts(artifactData.items || []);
      try {
        const workspaceData = await aiKanbanApi.getWorkspaceFiles(taskId);
        setWorkspaceFiles(workspaceData.files || []);
      } catch {
        setWorkspaceFiles([]);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.loadDetailFailed'));
      setDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, [t]);

  useEffect(() => {
    loadBoard();
    loadCandidates();
  }, [loadBoard, loadCandidates]);

  useEffect(() => {
    if (selectedTaskId) loadTaskDetail(selectedTaskId);
  }, [selectedTaskId, loadTaskDetail]);

  const cardsById = useMemo(() => {
    const map = new Map<string, AIKanbanCard>();
    COLUMN_KEYS.forEach((column) => board.columns[column]?.forEach((card) => map.set(card.id, card)));
    return map;
  }, [board.columns]);

  const filteredColumns = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return board.columns;
    return COLUMN_KEYS.reduce<Record<AIKanbanColumnKey, AIKanbanCard[]>>((acc, column) => {
      acc[column] = (board.columns[column] || []).filter((card) => [card.id, card.display, card.goal, card.agent_profile, card.persona_name, card.failure_reason].join('\n').toLowerCase().includes(keyword));
      return acc;
    }, { ...emptyColumns });
  }, [board.columns, searchQuery]);

  const candidateOptions = useMemo(() => candidates.map((item) => item.node_id), [candidates]);

  const allBoardCards = useMemo(() => COLUMN_KEYS.flatMap((column) => board.columns[column] || []), [board.columns]);

  const bulkDeleteStatusTargets = useMemo((): BulkDeleteStatus[] => {
    if (bulkDeleteColumn) return COLUMN_TO_BULK_STATUSES[bulkDeleteColumn];
    if (bulkDeleteCategory === 'all') return BULK_DELETE_API_STATUSES;
    return [bulkDeleteCategory];
  }, [bulkDeleteColumn, bulkDeleteCategory]);

  const bulkDeletePreview = useMemo(() => {
    const cards = bulkDeleteColumn
      ? (board.columns[bulkDeleteColumn] || [])
      : bulkDeleteCategory === 'all'
        ? allBoardCards
        : allBoardCards.filter((card) => card.status === bulkDeleteCategory);
    const rootIds = new Set(cards.map((card) => (card.kind === 'root' ? card.id : card.root_task_id)));
    const subtaskCount = cards.filter((card) => card.kind === 'subtask').length;
    return { rootCount: rootIds.size, cardCount: cards.length, subtaskCount };
  }, [allBoardCards, board.columns, bulkDeleteCategory, bulkDeleteColumn]);

  const bulkDeleteCategoryLabel = bulkDeleteColumn
    ? t(`aiKanban.columns.${bulkDeleteColumn}`)
    : t(`aiKanban.bulkDelete.categories.${bulkDeleteCategory}`);

  const activeBulkFilterLabels = useMemo(() => {
    const labels: string[] = [];
    if (filters.scope_key.trim()) labels.push(`${t('aiKanban.filters.scopeKey')}: ${filters.scope_key.trim()}`);
    if (filters.bot_id.trim()) labels.push(`${t('aiKanban.filters.botId')}: ${filters.bot_id.trim()}`);
    if (filters.group_id.trim()) labels.push(`${t('aiKanban.filters.groupId')}: ${filters.group_id.trim()}`);
    if (filters.owner_user_id.trim()) labels.push(`${t('aiKanban.filters.ownerUserId')}: ${filters.owner_user_id.trim()}`);
    return labels;
  }, [filters, t]);

  const openDetail = (task: AIKanbanCard) => {
    setSelectedTaskId(task.id);
  };

  const openAction = (action: PendingAction) => {
    setFailReason('');
    setRespawnDraft({ description: action.task?.goal || action.task?.display || '', agent_profile: action.task?.agent_profile || '' });
    setApprovalNote('');
    setPendingAction(action);
  };

  const runAction = async () => {
    if (!pendingAction && !secondConfirmAction) return;
    if (pendingAction?.type === 'hardDelete' && !secondConfirmAction) {
      setSecondConfirmAction(pendingAction);
      setPendingAction(null);
      return;
    }
    try {
      setIsActing(true);
      const action = secondConfirmAction || pendingAction;
      if (action.type === 'deleteArtifact' && action.artifact) {
        await aiKanbanApi.deleteArtifact(action.artifact.id);
        toast.success(t('aiKanban.messages.artifactDeleted'));
      } else if (action.task) {
        const task = action.task;
        if (action.type === 'pause') await aiKanbanApi.pauseTask(task.id);
        if (action.type === 'resume') await aiKanbanApi.resumeTask(task.id);
        if (action.type === 'fail') await aiKanbanApi.failTask(task.id, { reason: failReason.trim() || t('aiKanban.defaultFailReason'), cascade: task.kind === 'root' });
        if (action.type === 'hardDelete') {
          await aiKanbanApi.hardDeleteTask(task.id, { delete_files: true, include_instances: false });
          toast.success(t('aiKanban.messages.hardDeleteSuccess'));
          if (selectedTaskId === task.id || detail?.root?.id === task.id) {
            setSelectedTaskId(null);
          }
        }
        if (action.type === 'respawn') await aiKanbanApi.respawnSubtask(task.id, { new_description: respawnDraft.description.trim() || undefined, new_agent_profile: respawnDraft.agent_profile || undefined });
        if (action.type === 'approve') await aiKanbanApi.approveSubtask(task.id, { approved: true, note: approvalNote.trim() || undefined });
        if (action.type === 'reject') await aiKanbanApi.approveSubtask(task.id, { approved: false, note: approvalNote.trim() || undefined });
        if (action.type !== 'hardDelete') {
          toast.success(t('aiKanban.messages.actionSuccess'));
        }
      }
      setPendingAction(null);
      setSecondConfirmAction(null);
      await loadBoard();
      if (selectedTaskId && action.type !== 'hardDelete') await loadTaskDetail(selectedTaskId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.actionFailed'));
    } finally {
      setIsActing(false);
    }
  };

  const onDropToColumn = (column: AIKanbanColumnKey, taskId: string) => {
    const task = cardsById.get(taskId);
    if (!task || task.kanban_column === column) return;
    if (column === 'Blocked') {
      openAction({ type: 'pause', task, title: t('aiKanban.actions.pause'), description: t('aiKanban.confirm.pause', { name: task.display }), confirmLabel: t('aiKanban.actions.pause') });
    } else if (column === 'progress' || column === 'target') {
      openAction({ type: 'resume', task, title: t('aiKanban.actions.resume'), description: t('aiKanban.confirm.resume', { name: task.display }), confirmLabel: t('aiKanban.actions.resume') });
    } else if (column === 'failed') {
      openAction({ type: 'fail', task, title: t('aiKanban.actions.fail'), description: task.kind === 'root' ? t('aiKanban.confirm.failRoot', { name: task.display }) : t('aiKanban.confirm.failSubtask', { name: task.display }), confirmLabel: t('aiKanban.actions.fail'), destructive: true });
    } else {
      toast.info(t('aiKanban.messages.doneDropUnsupported'));
    }
  };

  const createTaskTree = async () => {
    const validSubtasks = subtasks
      .map((item) => ({
        description: item.description.trim(),
        agent_profile: item.agent_profile.trim(),
        depends_on: item.depends_on.split(/[,，\s]+/).map((value) => value.trim()).filter(Boolean).map(Number).filter((value) => Number.isFinite(value)),
      }))
      .filter((item) => item.description && item.agent_profile);
    if (!createDraft.goal.trim() || !createDraft.persona_name.trim() || validSubtasks.length === 0) {
      toast.error(t('aiKanban.messages.createValidation'));
      return;
    }
    try {
      setIsCreating(true);
      const data = await aiKanbanApi.createTaskTree({
        goal: createDraft.goal.trim(),
        persona_name: createDraft.persona_name.trim(),
        bot_id: createDraft.bot_id.trim() || undefined,
        owner_user_id: createDraft.owner_user_id.trim() || undefined,
        interval_hours: Number(createDraft.interval_hours) || 0,
        subtasks: validSubtasks,
      });
      toast.success(t('aiKanban.messages.createSuccess'));
      setCreateOpen(false);
      setSelectedTaskId(data.task.id);
      await loadBoard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const evaluateMesh = async () => {
    if (!evaluateDraft.user_goal.trim()) {
      toast.error(t('aiKanban.messages.evaluateValidation'));
      return;
    }
    try {
      setIsEvaluating(true);
      const data = await aiKanbanApi.evaluateMesh({
        user_goal: evaluateDraft.user_goal.trim(),
        owner_user_id: evaluateDraft.owner_user_id.trim() || undefined,
        persona_name: evaluateDraft.persona_name.trim() || undefined,
      });
      setEvaluateResult(data);
      if (data.suggested_subtasks?.length) {
        setCreateDraft((prev) => ({ ...prev, goal: data.user_goal, owner_user_id: data.owner_user_id || prev.owner_user_id, persona_name: evaluateDraft.persona_name || prev.persona_name }));
        setSubtasks(data.suggested_subtasks.map((item) => ({ description: item.description, agent_profile: item.agent_profile, depends_on: item.depends_on?.join(',') || '' })));
      }
      toast.success(t('aiKanban.messages.evaluateSuccess'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.evaluateFailed'));
    } finally {
      setIsEvaluating(false);
    }
  };

  const clearArtifactPreview = (artifactId: string) => {
    setArtifactPreview((prev) => {
      const current = prev[artifactId];
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      const next = { ...prev };
      delete next[artifactId];
      return next;
    });
  };

  const clearWorkspacePreview = (path: string) => {
    setWorkspacePreview((prev) => {
      const current = prev[path];
      if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
      const next = { ...prev };
      delete next[path];
      return next;
    });
  };

  const previewArtifact = async (artifact: AIArtifactItem | AIKanbanArtifactBrief) => {
    if (artifactPreview[artifact.id]) {
      clearArtifactPreview(artifact.id);
      return;
    }
    try {
      const filename = getArtifactFilename(artifact);
      if (isImageFile(artifact.mime, filename) && 'has_payload_path' in artifact && artifact.has_payload_path) {
        const blob = await aiKanbanApi.downloadArtifactRaw(artifact.id);
        const objectUrl = URL.createObjectURL(blob);
        setArtifactPreview((prev) => ({ ...prev, [artifact.id]: { kind: 'image', content: objectUrl, objectUrl } }));
        return;
      }
      const data = await aiKanbanApi.getArtifactDetail(artifact.id);
      setArtifactPreview((prev) => ({ ...prev, [artifact.id]: { kind: 'text', content: data.payload_preview || t('aiKanban.emptyPreview') } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.artifactPreviewFailed'));
    }
  };

  const previewWorkspaceFile = async (file: AIWorkspaceFile) => {
    if (!selectedTaskId) return;
    if (workspacePreview[file.path]) {
      clearWorkspacePreview(file.path);
      return;
    }
    try {
      const filename = getBasename(file.path) || file.path;
      const blob = await aiKanbanApi.downloadWorkspaceFile(selectedTaskId, file.path);
      const mime = blob.type;
      if (isImageFile(mime, filename)) {
        const objectUrl = URL.createObjectURL(blob);
        setWorkspacePreview((prev) => ({ ...prev, [file.path]: { kind: 'image', content: objectUrl, objectUrl } }));
        return;
      }
      if (isTextFile(mime, filename)) {
        const content = await blob.text();
        setWorkspacePreview((prev) => ({ ...prev, [file.path]: { kind: 'text', content: content || t('aiKanban.emptyPreview') } }));
        return;
      }
      setWorkspacePreview((prev) => ({ ...prev, [file.path]: { kind: 'unsupported', content: t('aiKanban.preview.unsupported') } }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.workspacePreviewFailed'));
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'download';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const uploadWorkspaceFile = async (file?: File) => {
    if (!file || !selectedTaskId) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error(t('aiKanban.messages.fileTooLarge'));
      return;
    }
    try {
      await aiKanbanApi.importWorkspaceFile(selectedTaskId, file, 'inputs');
      toast.success(t('aiKanban.messages.uploadSuccess'));
      await loadTaskDetail(selectedTaskId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.uploadFailed'));
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  };

  const submitPatch = async () => {
    if (!selectedTaskId || !patchDraft.patch_text.trim()) return;
    try {
      setIsSubmittingPatch(true);
      const data = await aiKanbanApi.submitPatch(selectedTaskId, {
        patch_text: patchDraft.patch_text,
        summary: patchDraft.summary || t('aiKanban.patch.defaultSummary'),
        mime: 'text/x-patch',
      });
      toast.success(data.warning || t('aiKanban.messages.patchSubmitted'));
      setPatchOpen(false);
      setPatchDraft({ summary: '', patch_text: '' });
      await loadTaskDetail(selectedTaskId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('aiKanban.messages.patchFailed')));
    } finally {
      setIsSubmittingPatch(false);
    }
  };

  const openBulkDeleteConfirm = () => {
    setBulkDeleteColumn(null);
    setBulkDeleteSecondConfirmOpen(false);
    setBulkDeleteOpen(true);
  };

  const openColumnBulkDelete = (column: AIKanbanColumnKey) => {
    setBulkDeleteColumn(column);
    setBulkDeleteSecondConfirmOpen(false);
    setBulkDeleteOpen(true);
  };

  const closeBulkDeleteDialogs = () => {
    setBulkDeleteOpen(false);
    setBulkDeleteSecondConfirmOpen(false);
    setBulkDeleteColumn(null);
  };

  const runBulkDelete = async () => {
    try {
      setIsBulkDeleting(true);
      const baseParams = {
        scope_key: filters.scope_key.trim() || undefined,
        bot_id: filters.bot_id.trim() || undefined,
        group_id: filters.group_id.trim() || undefined,
        owner_user_id: filters.owner_user_id.trim() || undefined,
        delete_files: true,
        include_instances: false,
      };
      const targets = bulkDeleteStatusTargets;
      const results = await Promise.all(targets.map((status) => aiKanbanApi.bulkHardDeleteTasks({ ...baseParams, status })));
      const deletedCount = results.reduce((sum, item) => sum + (item.deleted_count || 0), 0);
      const failedCount = results.reduce((sum, item) => sum + (item.failed_count || 0), 0);
      toast.success(t('aiKanban.messages.bulkDeleteSuccess', { deleted: deletedCount, failed: failedCount }));
      closeBulkDeleteDialogs();
      setSelectedTaskId(null);
      await loadBoard();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('aiKanban.messages.bulkDeleteFailed'));
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const renderCard = (task: AIKanbanCard) => (
    <div
      key={task.id}
      draggable
      onDragStart={(event) => event.dataTransfer.setData('text/plain', task.id)}
      onClick={() => openDetail(task)}
      className={cn(
        'group glass-card-flat relative cursor-pointer rounded-xl p-3 shadow-[0_2px_10px_hsl(0_0%_0%/0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_10px_30px_hsl(0_0%_0%/0.10)]',
        task.kind === 'subtask' && 'pl-4 before:absolute before:inset-y-3 before:left-1.5 before:w-1 before:rounded-full before:bg-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-sm font-semibold leading-snug line-clamp-2">{task.display}</h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('px-1.5 py-0 text-[10px]', task.kind === 'root' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30' : 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30')}>
              {task.kind === 'root' ? t('aiKanban.kind.root') : t('aiKanban.kind.subtask')}
            </Badge>
            <Badge className={cn('px-1.5 py-0 text-[10px]', statusClass(task.status))}>{task.status}</Badge>
            {task.kind === 'root' && task.subtask_count > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{task.subtask_done_count}/{task.subtask_count}</Badge>}
            {task.respawn_count > 0 && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">↻ {task.respawn_count}</Badge>}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-80 sm:opacity-0 sm:group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
            <DropdownMenuItem onClick={() => openDetail(task)}><FileText className="mr-2 h-4 w-4" />{t('aiKanban.actions.detail')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAction({ type: 'pause', task, title: t('aiKanban.actions.pause'), description: t('aiKanban.confirm.pause', { name: task.display }), confirmLabel: t('aiKanban.actions.pause') })}><PauseCircle className="mr-2 h-4 w-4" />{t('aiKanban.actions.pause')}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => openAction({ type: 'resume', task, title: t('aiKanban.actions.resume'), description: t('aiKanban.confirm.resume', { name: task.display }), confirmLabel: t('aiKanban.actions.resume') })}><PlayCircle className="mr-2 h-4 w-4" />{t('aiKanban.actions.resume')}</DropdownMenuItem>
            {task.kind === 'subtask' && <DropdownMenuItem onClick={() => openAction({ type: 'respawn', task, title: t('aiKanban.actions.respawn'), description: t('aiKanban.confirm.respawn', { name: task.display }), confirmLabel: t('aiKanban.actions.respawn') })}><RotateCcw className="mr-2 h-4 w-4" />{t('aiKanban.actions.respawn')}</DropdownMenuItem>}
            {task.kind === 'subtask' && <DropdownMenuItem onClick={() => openAction({ type: 'approve', task, title: t('aiKanban.actions.approve'), description: t('aiKanban.confirm.approve', { name: task.display }), confirmLabel: t('aiKanban.actions.approve') })}><CheckCircle2 className="mr-2 h-4 w-4" />{t('aiKanban.actions.approve')}</DropdownMenuItem>}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={() => openAction({ type: 'fail', task, title: t('aiKanban.actions.fail'), description: task.kind === 'root' ? t('aiKanban.confirm.failRoot', { name: task.display }) : t('aiKanban.confirm.failSubtask', { name: task.display }), confirmLabel: t('aiKanban.actions.fail'), destructive: true })}><XCircle className="mr-2 h-4 w-4" />{t('aiKanban.actions.fail')}</DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={() => openAction({ type: 'hardDelete', task, title: t('aiKanban.actions.hardDelete'), description: t('aiKanban.confirm.hardDelete', { name: task.display }), confirmLabel: t('aiKanban.actions.hardDelete'), destructive: true })}><Trash2 className="mr-2 h-4 w-4" />{t('aiKanban.actions.hardDelete')}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  useEffect(() => {
    artifactPreviewRef.current = artifactPreview;
  }, [artifactPreview]);

  useEffect(() => {
    workspacePreviewRef.current = workspacePreview;
  }, [workspacePreview]);

  useEffect(() => () => {
    Object.values(artifactPreviewRef.current).forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
    Object.values(workspacePreviewRef.current).forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
  }, []);

  const renderPreview = (preview: FilePreviewState) => {
    if (preview.kind === 'image') {
      return <div className="max-h-96 overflow-auto rounded-lg bg-muted/50 p-3"><img src={preview.content} alt={t('aiKanban.actions.preview')} className="max-h-80 max-w-full rounded-md object-contain" /></div>;
    }
    if (preview.kind === 'unsupported') {
      return <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{preview.content}</div>;
    }
    return <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">{preview.content}</pre>;
  };

  // page-viewport：整页高度锁定视口（main 不再竖直滚动），看板列内滚 + 底部横向滚动条
  // 始终贴视口底端；不要 overflow-hidden（会裁掉筛选卡与看板列的阴影）
  return (
    <div className="page-viewport flex flex-1 min-h-0 flex-col gap-4">
{/* 页面标题块：纯 H1 + 副标题，无右侧操作（按钮已移至下方 button group 同行） */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ClipboardList className="w-8 h-8" />
          {t('aiKanban.title')}
        </h1>
        <p className="text-muted-foreground mt-1">{t('aiKanban.description')}</p>
      </div>

      {/* TabButtonGroup 与操作按钮同行平齐（垂直居中） */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <TabButtonGroup
          value={viewMode}
          onValueChange={(v) => setViewMode(v as 'kanban' | 'data')}
          options={[
            { value: 'kanban', label: t('aiKanban.mode.kanban'), icon: <ClipboardList className="h-4 h-4" /> },
            { value: 'data', label: t('aiKanban.mode.data'), icon: <Database className="h-4 h-4" /> },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {viewMode === 'kanban' ? (
            <>
              <Button variant="outline" onClick={() => setEvaluateOpen(true)} className="w-full gap-2 sm:w-auto"><Sparkles className="h-4 w-4" />{t('aiKanban.evaluate.title')}</Button>
              <Button variant="outline" onClick={() => setCreateOpen(true)} className="w-full gap-2 sm:w-auto"><Plus className="h-4 w-4" />{t('aiKanban.create.title')}</Button>
              <Button variant="outline" onClick={openBulkDeleteConfirm} className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"><Trash2 className="h-4 w-4" />{t('aiKanban.bulkDelete.button')}</Button>
              <Button onClick={loadBoard} disabled={isLoadingBoard} className="w-full gap-2 sm:w-auto">
                {isLoadingBoard ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t('common.refresh') || t('aiKanban.refresh')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => stateStoreRef.current?.openBatchDelete()} disabled={stateStoreSelectedCount === 0} className="w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"><Trash2 className="h-4 w-4" />{t('aiKanban.stateStore.batchDelete.button')}</Button>
              <Button onClick={() => stateStoreRef.current?.refresh()} className="w-full gap-2 sm:w-auto">
                <RefreshCw className="h-4 w-4" />
                {t('common.refresh') || t('aiKanban.refresh')}
              </Button>
            </>
          )}
        </div>
      </div>

      {viewMode === 'kanban' && (
      <Card className="glass-card shrink-0">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Input value={filters.scope_key} onChange={(event) => setFilters((prev) => ({ ...prev, scope_key: event.target.value }))} placeholder={t('aiKanban.filters.scopeKey')} />
            <Input value={filters.bot_id} onChange={(event) => setFilters((prev) => ({ ...prev, bot_id: event.target.value }))} placeholder={t('aiKanban.filters.botId')} />
            <Input value={filters.group_id} onChange={(event) => setFilters((prev) => ({ ...prev, group_id: event.target.value }))} placeholder={t('aiKanban.filters.groupId')} />
            <Input value={filters.owner_user_id} onChange={(event) => setFilters((prev) => ({ ...prev, owner_user_id: event.target.value }))} placeholder={t('aiKanban.filters.ownerUserId')} />
            <Select value={filters.status} onValueChange={(value) => setFilters((prev) => ({ ...prev, status: value }))}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VALUE}>{t('aiKanban.filters.allStatus')}</SelectItem>
                {['pending', 'running', 'completed', 'skipped', 'paused', 'waiting_approval', 'failed', 'cancelled'].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={t('aiKanban.filters.search')} className="pl-9" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Switch checked={includeChildren} onCheckedChange={setIncludeChildren} />
              <Label>{includeChildren ? t('aiKanban.filters.includeChildren') : t('aiKanban.filters.onlyRoot')}</Label>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{t('aiKanban.summary.root')}: {board.summary.task_count}</Badge>
              <Badge variant="secondary">{t('aiKanban.summary.subtask')}: {board.summary.subtask_count}</Badge>
              <Badge variant="outline"><Clock className="mr-1 h-3 w-3" />{formatDate(board.summary.updated_at)}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 横滚容器：.layout-page-inner .overflow-x-auto 会注入 --shadow-bleed 内边距/负边距，
          这里加大到 1.5rem 才装得下列卡片的大阴影（尤其暗色）。列自身 h-full、任务列表内滚；
          纵向平时不滚（列高恰好填满），仅当视口矮于列 min-h 时兜底出现纵向滚动 */}
      {viewMode === 'kanban' && (
      <div className="min-h-0 flex-1 overflow-x-auto [--shadow-bleed:1.5rem]">
        <div className="flex h-full min-w-max gap-4">
        {COLUMN_KEYS.map((column) => (
          <div
            key={column}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDropToColumn(column, event.dataTransfer.getData('text/plain'))}
            className={cn(
              // 移动端页面整体可滚（page-viewport 仅桌面锁高），列高用 70dvh 封顶、任务列表内滚
              'flex h-full min-h-[460px] max-h-[70dvh] md:max-h-none w-[min(82vw,320px)] shrink-0 flex-col rounded-2xl border p-3 transition-colors sm:w-[320px] xl:w-[340px] glass-card',
              columnAccentClass(column),
            )}
            style={{
              ['--card-opacity' as string]: (cardOpacity / 100).toString(),
              ['--blur-intensity' as string]: `${blurIntensity}px`,
            }}
          >
            <div className="mb-3 flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                {(() => {
                  const meta = COLUMN_HEADER_META[column];
                  return (
                    <>
                      <meta.Icon className={cn('h-4 w-4 shrink-0', meta.titleClass)} />
                      <span className={cn('truncate font-semibold', meta.titleClass)}>{t(`aiKanban.columns.${column}`)}</span>
                      <Badge variant="secondary" className={cn('border-transparent', meta.badgeClass)}>{filteredColumns[column]?.length || 0}</Badge>
                    </>
                  );
                })()}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title={t('aiKanban.bulkDelete.columnButton')}
                aria-label={t('aiKanban.bulkDelete.columnButton')}
                disabled={isBulkDeleting || (board.columns[column]?.length || 0) === 0}
                onClick={(event) => {
                  event.stopPropagation();
                  openColumnBulkDelete(column);
                }}
                className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {isLoadingBoard ? (
                <Card className="glass-card"><CardContent className="py-10 text-center text-muted-foreground"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />{t('common.loading')}</CardContent></Card>
              ) : (filteredColumns[column] || []).length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">{t('aiKanban.emptyColumn')}</div>
              ) : (
                filteredColumns[column].map(renderCard)
              )}
            </div>
          </div>
        ))}
        </div>
      </div>
      )}

      {viewMode === 'data' && (
        <div className="min-h-0 flex-1">
          <StateStoreViewer ref={stateStoreRef} onSelectionChange={setStateStoreSelectedCount} />
        </div>
      )}

      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent overlayClassName="bg-white/80 dark:bg-black/80" className="flex w-full flex-col bg-background/95 p-0 sm:max-w-[1100px] glass-card">
          <SheetHeader className="shrink-0 border-b px-6 py-4 text-left">
            <SheetTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-primary" />{detail?.task.display || t('aiKanban.detail.title')}</SheetTitle>
            <SheetDescription>{detail?.task.goal || t('aiKanban.detail.description')}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />{t('common.loading')}</div>
            ) : detail ? (
              <Tabs value={detailTab} onValueChange={setDetailTab} className="space-y-4">
                <TabButtonGroup
                  value={detailTab}
                  onValueChange={setDetailTab}
                  className="grid w-full grid-cols-2 md:grid-cols-4"
                  buttonClassName="justify-center"
                  options={[
                    { value: 'subtasks', label: t('aiKanban.detail.subtasks'), icon: <Boxes className="h-4 w-4" /> },
                    { value: 'logs', label: t('aiKanban.detail.logs'), icon: <ShieldAlert className="h-4 w-4" /> },
                    { value: 'artifacts', label: t('aiKanban.detail.artifacts'), icon: <Archive className="h-4 w-4" /> },
                    { value: 'workspace', label: t('aiKanban.detail.workspace'), icon: <FileCode2 className="h-4 w-4" /> },
                  ]}
                />

                <TabsContent value="subtasks" className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-base">{t('aiKanban.detail.rootInfo')}</CardTitle>
                      <CardDescription className="font-mono">{detail.root?.id}</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">{t('aiKanban.fields.status')}</Label>{/* Badge 是 div，不能作为 <p> 子元素（validateDOMNesting） */}<div><Badge className={statusClass(detail.task.status)}>{detail.task.status}</Badge></div></div>
                      <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">{t('aiKanban.fields.agent')}</Label><p>{detail.task.agent_profile || '-'}</p></div>
                      <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">{t('aiKanban.fields.workspace')}</Label><p className="break-all font-mono text-xs">{detail.task.workspace_path || '-'}</p></div>
                    </CardContent>
                  </Card>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {detail.subtasks.length === 0 ? <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">{t('aiKanban.detail.noSubtasks')}</CardContent></Card> : detail.subtasks.map((task) => renderCard(task))}
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-3">
                  {detail.logs.length === 0 ? <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">{t('aiKanban.detail.noLogs')}</CardContent></Card> : detail.logs.map((log, index) => (
                    <div key={`${log.timestamp}-${index}`} className={cn('rounded-xl border p-4', logClass(log.event_type))}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge variant="outline">{log.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{log.content}</p>
                    </div>
                  ))}
                </TabsContent>

                <TabsContent value="artifacts" className="space-y-3">
                  {artifacts.length === 0 ? <Card className="glass-card"><CardContent className="py-12 text-center text-muted-foreground">{t('aiKanban.detail.noArtifacts')}</CardContent></Card> : artifacts.map((artifact) => (
                    <Card key={artifact.id} className="glass-card">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div className="min-w-0 space-y-2 lg:flex-1">
                            <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{shortId(artifact.id)}</Badge><Badge variant="secondary">{artifact.artifact_kind}</Badge><Badge variant="outline">{artifact.mime}</Badge><Badge variant="outline">{formatBytes(artifact.size_bytes)}</Badge></div>
                            <p className="font-medium">{artifact.summary || '-'}</p>
                            <p className="text-xs text-muted-foreground">{artifact.from_profile || '-'} · {formatDate(artifact.created_at)}</p>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-start gap-2">
                            <Button variant="outline" size="sm" onClick={() => previewArtifact(artifact)}><Eye className="mr-1 h-4 w-4" />{artifactPreview[artifact.id] ? t('aiKanban.actions.collapse') : t('aiKanban.actions.preview')}</Button>
                            {artifact.has_payload_path && <Button variant="outline" size="sm" onClick={async () => downloadBlob(await aiKanbanApi.downloadArtifactRaw(artifact.id), getArtifactFilename(artifact))}><Download className="mr-1 h-4 w-4" />{t('aiKanban.actions.download')}</Button>}
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => openAction({ type: 'deleteArtifact', artifact, title: t('aiKanban.actions.deleteArtifact'), description: t('aiKanban.confirm.deleteArtifact', { id: artifact.id }), confirmLabel: t('common.delete'), destructive: true })}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                        {artifactPreview[artifact.id] && renderPreview(artifactPreview[artifact.id])}
                      </CardContent>
                    </Card>
                  ))}
                </TabsContent>

                <TabsContent value="workspace" className="space-y-4">
                  <Card className="glass-card">
                    <CardHeader>
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        {/* 左侧 min-w-0 让长路径换行收缩；右侧 shrink-0 保证两个按钮同行不被挤成竖排 */}
                        <div className="min-w-0 lg:flex-1">
                          <CardTitle className="text-base">{t('aiKanban.workspace.title')}</CardTitle>
                          <CardDescription className="break-all font-mono">{detail.task.workspace_path || '-'}</CardDescription>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-start gap-2">
                          <input ref={uploadInputRef} type="file" className="hidden" onChange={(event) => uploadWorkspaceFile(event.target.files?.[0])} />
                          <Button variant="outline" onClick={() => uploadInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" />{t('aiKanban.workspace.upload')}</Button>
                          <Button variant="outline" onClick={() => setPatchOpen(true)}><FileCode2 className="mr-2 h-4 w-4" />{t('aiKanban.workspace.patch')}</Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {workspaceFiles.length === 0 ? <div className="py-10 text-center text-muted-foreground">{t('aiKanban.workspace.empty')}</div> : workspaceFiles.map((file) => (
                        <div key={file.path} className="rounded-lg border border-border/50 p-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 sm:flex-1"><p className="truncate font-mono text-sm">{file.path}</p><p className="text-xs text-muted-foreground">{formatBytes(file.size_bytes)} · {formatDate(file.modified_at)}</p></div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => previewWorkspaceFile(file)}><FileImage className="mr-1 h-4 w-4" />{workspacePreview[file.path] ? t('aiKanban.actions.collapse') : t('aiKanban.actions.preview')}</Button>
                              <Button variant="outline" size="sm" onClick={async () => selectedTaskId && downloadBlob(await aiKanbanApi.downloadWorkspaceFile(selectedTaskId, file.path), getBasename(file.path) || 'workspace-file')}><Download className="mr-1 h-4 w-4" />{t('aiKanban.actions.download')}</Button>
                            </div>
                          </div>
                          {workspacePreview[file.path] && <div className="mt-3">{renderPreview(workspacePreview[file.path])}</div>}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300"><AlertTriangle className="mr-2 inline h-4 w-4" />{t('aiKanban.workspace.patchWarning')}</div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="py-24 text-center text-muted-foreground">{t('aiKanban.detail.selectTask')}</div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="flex max-h-[92vh] flex-col p-0 sm:max-w-[1040px] glass-card">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" />{t('aiKanban.create.title')}</DialogTitle>
            <DialogDescription>{t('aiKanban.create.description')}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-auto p-6">
            <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
              <aside className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />{t('aiKanban.create.guideTitle')}</div>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-2"><Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full p-0">1</Badge><span>{t('aiKanban.create.guideGoal')}</span></li>
                  <li className="flex gap-2"><Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full p-0">2</Badge><span>{t('aiKanban.create.guideSubtasks')}</span></li>
                  <li className="flex gap-2"><Badge variant="secondary" className="h-5 min-w-5 justify-center rounded-full p-0">3</Badge><span>{t('aiKanban.create.guideDepends')}</span></li>
                </ol>
                <Button variant="secondary" className="w-full gap-2" onClick={() => { setCreateOpen(false); setEvaluateOpen(true); }}><Sparkles className="h-4 w-4" />{t('aiKanban.create.useEvaluator')}</Button>
              </aside>
              <div className="space-y-5">
                <div className="rounded-2xl border border-border/50 p-4">
                  <div className="mb-4 flex items-center gap-2"><Badge>1</Badge><Label className="text-base">{t('aiKanban.create.basicInfo')}</Label></div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2 space-y-2"><Label>{t('aiKanban.create.goal')}</Label><Textarea value={createDraft.goal} onChange={(event) => setCreateDraft((prev) => ({ ...prev, goal: event.target.value }))} rows={4} placeholder={t('aiKanban.create.goalPlaceholder')} /></div>
                    <div className="space-y-2"><Label>{t('aiKanban.create.persona')}</Label><Input value={createDraft.persona_name} onChange={(event) => setCreateDraft((prev) => ({ ...prev, persona_name: event.target.value }))} placeholder={t('aiKanban.create.personaPlaceholder')} /></div>
                    <div className="space-y-2"><Label>{t('aiKanban.create.owner')}</Label><Input value={createDraft.owner_user_id} onChange={(event) => setCreateDraft((prev) => ({ ...prev, owner_user_id: event.target.value }))} placeholder={t('aiKanban.create.ownerPlaceholder')} /></div>
                    <div className="space-y-2"><Label>{t('aiKanban.create.bot')}</Label><Input value={createDraft.bot_id} onChange={(event) => setCreateDraft((prev) => ({ ...prev, bot_id: event.target.value }))} placeholder={t('aiKanban.create.optionalPlaceholder')} /></div>
                    <div className="space-y-2"><Label>{t('aiKanban.create.interval')}</Label><Input type="number" min={0} value={createDraft.interval_hours} onChange={(event) => setCreateDraft((prev) => ({ ...prev, interval_hours: Number(event.target.value) }))} /></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/50 p-4">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2"><Badge>2</Badge><div><Label className="text-base">{t('aiKanban.create.subtasks')}</Label><p className="text-xs text-muted-foreground">{t('aiKanban.create.subtasksHint')}</p></div></div>
                    <Button variant="outline" size="sm" onClick={() => setSubtasks((prev) => [...prev, { description: '', agent_profile: candidateOptions[0] || '', depends_on: '' }])}><Plus className="mr-1 h-4 w-4" />{t('common.add') || '+'}</Button>
                  </div>
                  <div className="space-y-3">
                    {subtasks.map((item, index) => (
                      <Card key={index} className="border-border/60 bg-card/70">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                          <div><CardTitle className="text-sm">{t('aiKanban.create.subtaskCard', { index })}</CardTitle><CardDescription>{t('aiKanban.create.subtaskCardHint')}</CardDescription></div>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSubtasks((prev) => prev.filter((_, i) => i !== index))}><Trash2 className="h-4 w-4" /></Button>
                        </CardHeader>
                        <CardContent className="grid gap-3 p-4 pt-2 md:grid-cols-[1fr_220px]">
                          <div className="space-y-2"><Label>{t('aiKanban.create.subtaskDescription')}</Label><Textarea value={item.description} onChange={(event) => setSubtasks((prev) => prev.map((row, i) => i === index ? { ...row, description: event.target.value } : row))} placeholder={t('aiKanban.create.subtaskPlaceholder')} rows={3} /></div>
                          <div className="space-y-3">
                            <div className="space-y-2"><Label>{t('aiKanban.create.agent')}</Label><Select value={item.agent_profile || ALL_VALUE} onValueChange={(value) => setSubtasks((prev) => prev.map((row, i) => i === index ? { ...row, agent_profile: value === ALL_VALUE ? '' : value } : row))}><SelectTrigger><SelectValue placeholder={t('aiKanban.create.agent')} /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>{t('aiKanban.create.selectAgent')}</SelectItem>{candidateOptions.map((profile) => <SelectItem key={profile} value={profile}>{profile}</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label>{t('aiKanban.create.dependsOn')}</Label><Input value={item.depends_on} onChange={(event) => setSubtasks((prev) => prev.map((row, i) => i === index ? { ...row, depends_on: event.target.value } : row))} placeholder={t('aiKanban.create.dependsPlaceholder')} /></div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="border-t px-6 py-4"><Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button><Button onClick={createTaskTree} disabled={isCreating}>{isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('aiKanban.create.submit')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={evaluateOpen} onOpenChange={setEvaluateOpen}>
        <DialogContent className="sm:max-w-[800px] glass-card">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />{t('aiKanban.evaluate.title')}</DialogTitle><DialogDescription>{t('aiKanban.evaluate.description')}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <Textarea value={evaluateDraft.user_goal} onChange={(event) => setEvaluateDraft((prev) => ({ ...prev, user_goal: event.target.value }))} rows={4} placeholder={t('aiKanban.evaluate.goalPlaceholder')} />
            <div className="grid gap-3 md:grid-cols-2"><Input value={evaluateDraft.owner_user_id} onChange={(event) => setEvaluateDraft((prev) => ({ ...prev, owner_user_id: event.target.value }))} placeholder={t('aiKanban.create.owner')} /><Input value={evaluateDraft.persona_name} onChange={(event) => setEvaluateDraft((prev) => ({ ...prev, persona_name: event.target.value }))} placeholder={t('aiKanban.create.persona')} /></div>
            {evaluateResult && <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs whitespace-pre-wrap">{JSON.stringify(evaluateResult, null, 2)}</pre>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setEvaluateOpen(false)}>{t('common.close') || t('common.cancel')}</Button><Button onClick={evaluateMesh} disabled={isEvaluating}>{isEvaluating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('aiKanban.evaluate.submit')}</Button><Button variant="secondary" onClick={() => { setEvaluateOpen(false); setCreateOpen(true); }} disabled={!evaluateResult}>{t('aiKanban.evaluate.useResult')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={patchOpen} onOpenChange={setPatchOpen}>
        <DialogContent className="sm:max-w-[820px] glass-card">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileCode2 className="h-5 w-5 text-primary" />{t('aiKanban.patch.title')}</DialogTitle><DialogDescription>{t('aiKanban.patch.description')}</DialogDescription></DialogHeader>
          <div className="space-y-3"><Input value={patchDraft.summary} onChange={(event) => setPatchDraft((prev) => ({ ...prev, summary: event.target.value }))} placeholder={t('aiKanban.patch.summary')} /><Textarea value={patchDraft.patch_text} onChange={(event) => setPatchDraft((prev) => ({ ...prev, patch_text: event.target.value }))} rows={14} className="font-mono text-xs" placeholder="diff --git a/src/foo.py b/src/foo.py" /></div>
          <DialogFooter><Button variant="outline" onClick={() => setPatchOpen(false)}>{t('common.cancel')}</Button><Button onClick={submitPatch} disabled={isSubmittingPatch || !patchDraft.patch_text.trim()}>{isSubmittingPatch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('aiKanban.patch.submit')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (open) return;
          setBulkDeleteOpen(false);
          // 进入二次确认时也会 close，此时保留 bulkDeleteColumn
          if (bulkDeleteAdvancingRef.current) {
            bulkDeleteAdvancingRef.current = false;
            return;
          }
          setBulkDeleteColumn(null);
        }}
      >
        <AlertDialogContent className="glass-card max-w-[92vw] sm:max-w-[560px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {bulkDeleteColumn
                ? t('aiKanban.bulkDelete.columnTitle', { column: bulkDeleteCategoryLabel })
                : t('aiKanban.bulkDelete.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteColumn
                ? t('aiKanban.bulkDelete.columnHint', { column: bulkDeleteCategoryLabel })
                : t('aiKanban.bulkDelete.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4">
            {bulkDeleteColumn ? (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">{t('aiKanban.bulkDelete.columnStatuses')}</p>
                <p className="mt-2 font-mono">
                  {bulkDeleteStatusTargets.map((status) => t(`aiKanban.bulkDelete.categories.${status}`)).join(' · ')}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>{t('aiKanban.bulkDelete.category')}</Label>
                <Select value={bulkDeleteCategory} onValueChange={(value) => setBulkDeleteCategory(value as BulkDeleteCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BULK_DELETE_STATUS_OPTIONS.map((status) => (
                      <SelectItem key={status} value={status}>{t(`aiKanban.bulkDelete.categories.${status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="mr-2 inline h-4 w-4" />
              {t('aiKanban.bulkDelete.preview', {
                roots: bulkDeletePreview.rootCount,
                cards: bulkDeletePreview.cardCount,
                subtasks: bulkDeletePreview.subtaskCount,
              })}
            </div>
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{t('aiKanban.bulkDelete.activeFilters')}</p>
              {activeBulkFilterLabels.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {activeBulkFilterLabels.map((label) => <li key={label}>{label}</li>)}
                </ul>
              ) : (
                <p className="mt-2">{t('aiKanban.bulkDelete.noExtraFilters')}</p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                bulkDeleteAdvancingRef.current = true;
                setBulkDeleteOpen(false);
                setBulkDeleteSecondConfirmOpen(true);
              }}
              disabled={isBulkDeleting || bulkDeletePreview.rootCount === 0}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('aiKanban.bulkDelete.continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteSecondConfirmOpen}
        onOpenChange={(open) => {
          if (!open) {
            setBulkDeleteSecondConfirmOpen(false);
            setBulkDeleteColumn(null);
          }
        }}
      >
        <AlertDialogContent className="glass-card border-destructive/50 max-w-[92vw] sm:max-w-[560px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              {t('aiKanban.bulkDelete.secondTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription className="font-medium text-destructive/90">
              {t('aiKanban.bulkDelete.secondDescription', {
                category: bulkDeleteCategoryLabel,
                roots: bulkDeletePreview.rootCount,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {t('aiKanban.bulkDelete.irreversible')}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isBulkDeleting}
              onClick={() => {
                setBulkDeleteSecondConfirmOpen(false);
                setBulkDeleteColumn(null);
              }}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={runBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isBulkDeleting ? t('common.loading') : t('aiKanban.bulkDelete.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">{pendingAction?.destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}{pendingAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>{pendingAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {pendingAction?.type === 'fail' && <div className="space-y-2"><Label>{t('aiKanban.actions.failReason')}</Label><Textarea value={failReason} onChange={(event) => setFailReason(event.target.value)} rows={3} /></div>}
          {pendingAction?.type === 'respawn' && <div className="space-y-3"><div className="space-y-2"><Label>{t('aiKanban.actions.newDescription')}</Label><Textarea value={respawnDraft.description} onChange={(event) => setRespawnDraft((prev) => ({ ...prev, description: event.target.value }))} rows={3} /></div><div className="space-y-2"><Label>{t('aiKanban.actions.newAgent')}</Label><Select value={respawnDraft.agent_profile || ALL_VALUE} onValueChange={(value) => setRespawnDraft((prev) => ({ ...prev, agent_profile: value === ALL_VALUE ? '' : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value={ALL_VALUE}>{t('aiKanban.create.selectAgent')}</SelectItem>{candidateOptions.map((profile) => <SelectItem key={profile} value={profile}>{profile}</SelectItem>)}</SelectContent></Select></div></div>}
          {(pendingAction?.type === 'approve' || pendingAction?.type === 'reject') && <div className="space-y-2"><Label>{t('aiKanban.actions.approvalNote')}</Label><Textarea value={approvalNote} onChange={(event) => setApprovalNote(event.target.value)} rows={3} /></div>}
          <AlertDialogFooter><AlertDialogCancel disabled={isActing}>{t('common.cancel')}</AlertDialogCancel><AlertDialogAction onClick={runAction} disabled={isActing} className={pendingAction?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}>{isActing ? t('common.loading') : pendingAction?.confirmLabel}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!secondConfirmAction} onOpenChange={(open) => !open && setSecondConfirmAction(null)}>
        <AlertDialogContent className="glass-card border-destructive/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />{secondConfirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription className="text-destructive/90 font-medium">{secondConfirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertTriangle className="mr-2 inline h-4 w-4" />
            {t('aiKanban.confirm.hardDelete', { name: secondConfirmAction?.task?.display || '' })}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActing} onClick={() => setSecondConfirmAction(null)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={runAction} disabled={isActing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{isActing ? t('common.loading') : secondConfirmAction?.confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
