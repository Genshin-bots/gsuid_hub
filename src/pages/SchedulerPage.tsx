import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Calendar,
  Clock,
  Play,
  Pause,
  RefreshCw,
  Search,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
} from 'lucide-react';
import { format, addHours, addMinutes, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { schedulerApi, type SchedulerJobsMeta } from '@/lib/api';
import { resolveSchedulerJobsView } from '@/lib/featureUtils';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { PinnedPage } from '@/components/layout/PinnedPage';

/** 调度任务每页条数（服务端分页；表格行较高，20 行一页） */
const SCHEDULER_PAGE_SIZE = 20;

interface ScheduledTask {
  id: string;
  name: string;
  description: string;
  cronExpression: string;
  cronDescription: string;
  status: 'running' | 'paused' | 'error';
  nextRun: Date;
  lastRun: Date | null;
  lastResult: 'success' | 'failed' | 'pending';
  runCount: number;
  avgDuration: string;
}

export default function SchedulerPage() {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // 已提交的搜索词：每次按键都打一次接口会打爆后端，防抖后再提交
  const [appliedSearch, setAppliedSearch] = useState('');
  const [page, setPage] = useState(1);
  // 服务端返回的分页与统计元数据（缺失 = 旧后端，走前端兜底）
  const [jobsMeta, setJobsMeta] = useState<SchedulerJobsMeta | null>(null);
  const [selectedTask, setSelectedTask] = useState<ScheduledTask | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // Fetch jobs from API
  const fetchJobs = async () => {
    setIsLoading(true);
    try {
      const res = await schedulerApi.getJobs({
        search: appliedSearch || undefined,
        limit: SCHEDULER_PAGE_SIZE,
        offset: (page - 1) * SCHEDULER_PAGE_SIZE,
      });
      const jobs = res.data ?? [];
      // Convert to frontend format
      const formattedJobs = jobs.map((job) => ({
        id: job.id,
        name: job.name,
        description: job.description || job.name, // Use docstring from backend
        cronExpression: job.trigger,
        cronDescription: job.trigger_description || job.trigger,
        status: job.paused ? ('paused' as const) : ('running' as const),
        nextRun: job.next_run_time ? new Date(job.next_run_time) : new Date(),
        lastRun: null,
        lastResult: 'success' as const,
        runCount: 0,
        avgDuration: 'N/A',
      }));
      setTasks(formattedJobs);
      setJobsMeta(res.meta ?? null);
    } catch (error) {
      console.error('Failed to fetch scheduler jobs:', error);
      toast.error(t('scheduler.loadFailed') || 'Unable to load task scheduler list');
    } finally {
      setIsLoading(false);
    }
  };

  // 搜索防抖：停手 400ms 才提交，避免每敲一个字打一次接口
  useEffect(() => {
    const id = setTimeout(() => {
      setAppliedSearch(searchQuery.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // 切页 / 改搜索 → 重新取当前页
  useEffect(() => {
    void fetchJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, page]);

  const jobsView = useMemo(
    () =>
      resolveSchedulerJobsView(
        { data: tasks, meta: jobsMeta ?? undefined },
        { search: appliedSearch },
        page,
        SCHEDULER_PAGE_SIZE,
      ),
    [tasks, jobsMeta, appliedSearch, page],
  );

  // 状态统计：来自服务端的**总数**，不随翻页/搜索变化
  const stats = jobsView.stats;

  const toggleTaskStatus = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      if (task.status === 'running') {
        await schedulerApi.pauseJob(taskId);
        toast.success(`Task "${task.name}" paused`);
      } else {
        await schedulerApi.resumeJob(taskId);
        toast.success(`Task "${task.name}" started`);
      }
      // Refresh jobs list
      fetchJobs();
    } catch (error) {
      console.error('Failed to toggle task status:', error);
      toast.error(t('scheduler.operationFailed') || 'Unable to change task status');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      await schedulerApi.runJob(taskId);
      toast.success(t('scheduler.taskExecutedDesc') || 'Task triggered for execution');
      // Refresh jobs list
      fetchJobs();
    } catch (error) {
      console.error('Failed to run job:', error);
      toast.error(t('scheduler.executionFailed') || 'Unable to trigger task execution');
    }
  };

  const getStatusBadge = (status: ScheduledTask['status']) => {
    switch (status) {
      case 'running':
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            {t('scheduler.running')}
          </Badge>
        );
      case 'paused':
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            {t('scheduler.paused')}
          </Badge>
        );
      case 'error':
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
            {t('scheduler.error')}
          </Badge>
        );
    }
  };

  const getResultIcon = (result: ScheduledTask['lastResult']) => {
    switch (result) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-destructive" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <PinnedPage
      header={
        <div className="min-w-0 sm:overflow-x-auto">
          <h1 className="sm:whitespace-nowrap text-3xl font-bold flex items-center gap-3">
            <Calendar className="w-8 h-8 shrink-0" />
            {t('scheduler.title')}
          </h1>
          <p className="sm:whitespace-nowrap text-muted-foreground mt-1">
            {t('scheduler.description')}
          </p>
        </div>
      }
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Timer className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t('scheduler.totalTasks')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Play className="w-8 h-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.running}</p>
                <p className="text-xs text-muted-foreground">{t('scheduler.running')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Pause className="w-8 h-8 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.paused}</p>
                <p className="text-xs text-muted-foreground">{t('scheduler.paused')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{stats.error}</p>
                <p className="text-xs text-muted-foreground">{t('scheduler.error')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t('scheduler.searchTask')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            {t('scheduler.taskList')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('scheduler.taskName')}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t('scheduler.executionCycle')}
                  </TableHead>
                  <TableHead>{t('scheduler.status')}</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('scheduler.nextExecution')}
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    {t('scheduler.lastResult')}
                  </TableHead>
                  <TableHead className="text-right">{t('scheduler.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobsView.items.map((task) => (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedTask(task)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{task.name}</p>
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {task.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div>
                        <p className="text-sm">{task.cronDescription}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {task.cronExpression}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(task.status)}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm">
                        {format(task.nextRun, 'MM-dd HH:mm', { locale: zhCN })}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        {getResultIcon(task.lastResult)}
                        <span className="text-xs text-muted-foreground">
                          {task.lastRun ? format(task.lastRun, 'HH:mm', { locale: zhCN }) : '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleTaskStatus(task.id)}
                          title={
                            task.status === 'running' ? t('scheduler.pause') : t('scheduler.start')
                          }
                        >
                          {task.status === 'running' ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => runTaskNow(task.id)}
                          title={t('scheduler.runNow')}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        {/* 分页控件 */}
        {jobsView.totalPages > 1 && !isLoading && (
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/50 p-4">
            <span className="text-xs text-muted-foreground mr-1">
              {t('scheduler.pagination.label', { total: jobsView.total })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {t('scheduler.pagination.prev')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t('scheduler.pagination.page', { current: page, total: jobsView.totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= jobsView.totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(jobsView.totalPages, p + 1))}
            >
              {t('scheduler.pagination.next')}
            </Button>
          </div>
        )}
      </Card>

      {/* Task Detail Dialog */}
      <Dialog open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5" />
              {selectedTask?.name}
            </DialogTitle>
            <DialogDescription>{selectedTask?.description}</DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-3 md:space-y-4">
              <div className="grid grid-cols-1 gap-3 md:gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.status')}</p>
                  {getStatusBadge(selectedTask.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.cronExpression')}</p>
                  <p className="font-mono text-sm">{selectedTask.cronExpression}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.executionCycle')}</p>
                  <p className="text-sm">{selectedTask.cronDescription}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.avgDuration')}</p>
                  <p className="text-sm">{selectedTask.avgDuration}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.nextRunTime')}</p>
                  <p className="text-sm">
                    {format(selectedTask.nextRun, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.lastRunTime')}</p>
                  <p className="text-sm">
                    {selectedTask.lastRun
                      ? format(selectedTask.lastRun, 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
                      : '-'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.totalRuns')}</p>
                  <p className="text-sm">{selectedTask.runCount.toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('scheduler.lastResult')}</p>
                  <div className="flex items-center gap-2">
                    {getResultIcon(selectedTask.lastResult)}
                    <span className="text-sm">
                      {selectedTask.lastResult === 'success'
                        ? t('scheduler.success')
                        : selectedTask.lastResult === 'failed'
                          ? t('scheduler.failed')
                          : t('scheduler.pending')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => toggleTaskStatus(selectedTask.id)}
                >
                  {selectedTask.status === 'running' ? (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      {t('scheduler.pause')} {t('scheduler.title')}
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      {t('scheduler.start')} {t('scheduler.title')}
                    </>
                  )}
                </Button>
                <Button className="flex-1" onClick={() => runTaskNow(selectedTask.id)}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  {t('scheduler.runNow')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PinnedPage>
  );
}
