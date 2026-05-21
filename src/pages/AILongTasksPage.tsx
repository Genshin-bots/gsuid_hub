import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  SquarePen,
  StopCircle,
  TerminalSquare,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  agentDebugApi,
  AgentDebugTaskDetail,
  AgentDebugTaskListItem,
  AgentDebugTaskStep,
} from '@/lib/api';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (['done', 'success', 'completed', 'finished'].includes(normalized)) return 'bg-green-500/15 text-green-600 border-green-500/30';
  if (['running', 'processing', 'active'].includes(normalized)) return 'bg-blue-500/15 text-blue-600 border-blue-500/30';
  if (['failed', 'error', 'aborted', 'cancelled'].includes(normalized)) return 'bg-red-500/15 text-red-600 border-red-500/30';
  if (['pending', 'waiting', 'queued'].includes(normalized)) return 'bg-amber-500/15 text-amber-600 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border/50';
}

export default function AILongTasksPage() {
  const { style } = useTheme();
  const isGlass = style === 'glassmorphism';

  const [tasks, setTasks] = useState<AgentDebugTaskListItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskDetail, setTaskDetail] = useState<AgentDebugTaskDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [limit, setLimit] = useState(100);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [editingStep, setEditingStep] = useState<AgentDebugTaskStep | null>(null);
  const [stepDraft, setStepDraft] = useState('');
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [abortTarget, setAbortTarget] = useState<AgentDebugTaskListItem | null>(null);
  const [isAborting, setIsAborting] = useState(false);

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId],
  );

  const loadTasks = useCallback(async () => {
    try {
      setIsLoadingTasks(true);
      const data = await agentDebugApi.getTasks({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit,
      });
      setTasks(data);
      if (data.length > 0) {
        setSelectedTaskId((current) => current && data.some((task) => task.id === current) ? current : data[0].id);
      } else {
        setSelectedTaskId(null);
        setTaskDetail(null);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || '加载长任务列表失败');
    } finally {
      setIsLoadingTasks(false);
    }
  }, [limit, statusFilter]);

  const loadTaskDetail = useCallback(async (taskId: string) => {
    try {
      setIsLoadingDetail(true);
      const data = await agentDebugApi.getTaskDetail(taskId);
      setTaskDetail(data);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || '加载长任务详情失败');
      setTaskDetail(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (selectedTaskId) loadTaskDetail(selectedTaskId);
  }, [selectedTaskId, loadTaskDetail]);

  const openStepEditor = (step: AgentDebugTaskStep) => {
    setEditingStep(step);
    setStepDraft(step.description);
  };

  const saveStep = async () => {
    if (!selectedTaskId || !editingStep) return;
    try {
      setIsSavingStep(true);
      await agentDebugApi.updateTaskStep(selectedTaskId, editingStep.id, stepDraft);
      toast.success('任务步骤已改写');
      setEditingStep(null);
      setStepDraft('');
      await loadTaskDetail(selectedTaskId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || '保存步骤失败');
    } finally {
      setIsSavingStep(false);
    }
  };

  const abortTask = async () => {
    if (!abortTarget) return;
    try {
      setIsAborting(true);
      await agentDebugApi.abortTask(abortTarget.id);
      toast.success('长任务已终止');
      setAbortTarget(null);
      await loadTasks();
      if (selectedTaskId) await loadTaskDetail(selectedTaskId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || '终止长任务失败');
    } finally {
      setIsAborting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Layers className="w-8 h-8" />
            长任务编排看板
          </h1>
          <p className="text-muted-foreground mt-1">查看长任务、步骤与执行日志，支持人工改写步骤和手动终止异常任务。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="running">running</SelectItem>
              <SelectItem value="pending">pending</SelectItem>
              <SelectItem value="done">done</SelectItem>
              <SelectItem value="failed">failed</SelectItem>
              <SelectItem value="aborted">aborted</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            max={500}
            value={limit}
            onChange={(e) => setLimit(Math.min(500, Math.max(1, Number(e.target.value) || 100)))}
            className="w-[110px]"
            title="返回数量限制"
          />
          <Button onClick={loadTasks} disabled={isLoadingTasks}>
            {isLoadingTasks ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            刷新
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <Card className={cn('xl:col-span-4', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>任务列表</span>
              <Badge variant="outline">{tasks.length}</Badge>
            </CardTitle>
            <CardDescription>按更新时间倒序展示，点击任务查看详情。</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTasks ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />正在加载任务...
              </div>
            ) : tasks.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">暂无长任务</div>
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-auto pr-1">
                {tasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className={cn(
                      'w-full rounded-lg border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent/30',
                      selectedTaskId === task.id ? 'border-primary/60 bg-primary/10' : 'border-border/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">#{task.ordinal}</Badge>
                          <Badge className={statusClass(task.status)}>{task.status}</Badge>
                        </div>
                        <h3 className="mt-2 font-semibold truncate">{task.display_name}</h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{task.goal}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{task.owner_user_id || '-'}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(task.updated_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="xl:col-span-8 space-y-4">
          {!selectedTask ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="py-16 text-center text-muted-foreground">请选择一个长任务查看详情</CardContent>
            </Card>
          ) : (
            <>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2">
                        <span>{taskDetail?.task.display_name || selectedTask.display_name}</span>
                        <Badge className={statusClass(taskDetail?.task.status || selectedTask.status)}>{taskDetail?.task.status || selectedTask.status}</Badge>
                      </CardTitle>
                      <CardDescription className="mt-2">{taskDetail?.task.goal || selectedTask.goal}</CardDescription>
                    </div>
                    <Button variant="destructive" onClick={() => setAbortTarget(selectedTask)}>
                      <StopCircle className="w-4 h-4 mr-2" />终止任务
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoadingDetail ? (
                    <div className="flex items-center text-muted-foreground"><Loader2 className="w-4 h-4 mr-2 animate-spin" />正在加载详情...</div>
                  ) : taskDetail && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">任务 ID</Label><p className="font-mono break-all">{taskDetail.task.id}</p></div>
                        <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">审核备注</Label><p>{taskDetail.task.review_notes || '-'}</p></div>
                        <div className="rounded-lg bg-muted/40 p-3"><Label className="text-muted-foreground">广播目标</Label><p>{taskDetail.task.broadcast_targets?.join(', ') || '-'}</p></div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FileText className="w-5 h-5 text-primary" />任务步骤</CardTitle>
                    <CardDescription>人工改写会影响后续执行，建议保留变更原因。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!taskDetail || taskDetail.steps.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">暂无步骤</div>
                    ) : (
                      <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                        {taskDetail.steps.map((step) => (
                          <div key={step.id} className="rounded-lg border border-border/50 p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline">Step {step.seq}</Badge>
                                <Badge className={statusClass(step.status)}>{step.status}</Badge>
                                {step.schedule_kind && <Badge variant="secondary">{step.schedule_kind}</Badge>}
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => openStepEditor(step)}>
                                <SquarePen className="w-4 h-4 mr-1" />改写
                              </Button>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{step.description}</p>
                            {step.result_summary && <p className="rounded bg-muted/40 p-2 text-xs text-muted-foreground whitespace-pre-wrap">{step.result_summary}</p>}
                            <p className="font-mono text-[11px] text-muted-foreground">{step.id}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TerminalSquare className="w-5 h-5 text-primary" />执行日志</CardTitle>
                    <CardDescription>最多展示后端返回的 200 条日志。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {!taskDetail || taskDetail.logs.length === 0 ? (
                      <div className="py-10 text-center text-muted-foreground">暂无日志</div>
                    ) : (
                      <div className="space-y-3 max-h-[560px] overflow-auto pr-1">
                        {taskDetail.logs.map((log, index) => (
                          <div key={`${log.timestamp}-${index}`} className="rounded-lg border border-border/50 p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <Badge variant="outline">{log.event_type}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDate(log.timestamp)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{log.content}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      <Dialog open={!!editingStep} onOpenChange={(open) => !open && setEditingStep(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>人工改写任务步骤</DialogTitle>
            <DialogDescription>提交内容会由服务端 strip 并截断到 2000 字符，同时写入任务日志。</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>步骤描述</Label>
            <Textarea value={stepDraft} onChange={(e) => setStepDraft(e.target.value)} rows={10} maxLength={2000} />
            <div className="text-right text-xs text-muted-foreground">{stepDraft.length}/2000</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingStep(null)}>取消</Button>
            <Button onClick={saveStep} disabled={isSavingStep || !stepDraft.trim()}>
              {isSavingStep ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              保存改写
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!abortTarget} onOpenChange={(open) => !open && setAbortTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-destructive" />确认终止长任务</AlertDialogTitle>
            <AlertDialogDescription>
              将手动终止「{abortTarget?.display_name}」并注销该任务关联的执行 Job。该操作可能中断后续执行流程。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAborting}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={abortTask} disabled={isAborting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isAborting ? '终止中...' : '确认终止'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
