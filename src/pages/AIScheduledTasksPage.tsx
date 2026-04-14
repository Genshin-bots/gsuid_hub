import { useState, useEffect, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Clock,
  Plus,
  Pause,
  Play,
  Trash2,
  Edit,
  RefreshCw,
  AlertCircle,
  Timer,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Filter,
} from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { aiScheduledTasksApi, AIScheduledTask, AIScheduledTaskStats, CreateScheduledTaskRequest } from '@/lib/api';
import { toast } from 'sonner';

// ============================================================================
// 组件定义
// ============================================================================

export default function AIScheduledTasksPage() {
  const { style } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';

  // 状态
  const [tasks, setTasks] = useState<AIScheduledTask[]>([]);
  const [stats, setStats] = useState<AIScheduledTaskStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 筛选状态
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 弹窗状态
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<AIScheduledTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 创建/编辑表单状态
  const [formData, setFormData] = useState<CreateScheduledTaskRequest>({
    task_type: 'interval',
    interval_type: 'minutes',
    interval_value: 30,
    task_prompt: '',
    max_executions: undefined,
    run_time: undefined,
  });

  // 加载任务列表
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params: { status?: string; task_type?: string } = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (typeFilter !== 'all') params.task_type = typeFilter;
      
      const data = await aiScheduledTasksApi.getTasks(params);
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aiScheduledTasks.loadFailed'));
      toast.error(err instanceof Error ? err.message : t('aiScheduledTasks.loadFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  // 加载统计数据
  const fetchStats = async () => {
    try {
      const data = await aiScheduledTasksApi.getStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [statusFilter, typeFilter, t]);

  // 筛选后的任务列表
  const filteredTasks = useMemo(() => {
    return tasks.filter(task =>
      task.task_prompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.task_id.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [tasks, searchQuery]);

  // 获取状态徽章
  const getStatusBadge = (status: AIScheduledTask['status']) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">{t('aiScheduledTasks.statusPending')}</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">{t('aiScheduledTasks.statusPaused')}</Badge>;
      case 'executed':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">{t('aiScheduledTasks.statusExecuted')}</Badge>;
      case 'failed':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">{t('aiScheduledTasks.statusFailed')}</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-500/20 text-gray-500 border-gray-500/30">{t('aiScheduledTasks.statusCancelled')}</Badge>;
    }
  };

  // 格式化时间间隔
  const formatInterval = (seconds: number) => {
    if (seconds < 60) return `${seconds} ${t('aiScheduledTasks.intervalMinutes').replace('{minutes}', '')}`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} ${t('aiScheduledTasks.intervalMinutes').replace('{minutes}', '')}`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} ${t('aiScheduledTasks.intervalHours').replace('{hours}', '')}`;
    return `${Math.floor(seconds / 86400)} ${t('aiScheduledTasks.intervalDays').replace('{days}', '')}`;
  };

  // 暂停任务
  const handlePause = async (task: AIScheduledTask) => {
    try {
      await aiScheduledTasksApi.pauseTask(task.task_id);
      toast.success(t('aiScheduledTasks.pauseSuccess'));
      fetchTasks();
      fetchStats();
    } catch (err) {
      toast.error(t('aiScheduledTasks.pauseFailed'));
    }
  };

  // 恢复任务
  const handleResume = async (task: AIScheduledTask) => {
    try {
      await aiScheduledTasksApi.resumeTask(task.task_id);
      toast.success(t('aiScheduledTasks.resumeSuccess'));
      fetchTasks();
      fetchStats();
    } catch (err) {
      toast.error(t('aiScheduledTasks.resumeFailed'));
    }
  };

  // 删除任务
  const handleDelete = async () => {
    if (!selectedTask) return;
    try {
      await aiScheduledTasksApi.deleteTask(selectedTask.task_id);
      toast.success(t('aiScheduledTasks.deleteSuccess'));
      setDeleteDialogOpen(false);
      setSelectedTask(null);
      fetchTasks();
      fetchStats();
    } catch (err) {
      toast.error(t('aiScheduledTasks.deleteFailed'));
    }
  };

  // 创建任务
  const handleCreate = async () => {
    try {
      setIsSaving(true);
      await aiScheduledTasksApi.createTask(formData);
      toast.success(t('aiScheduledTasks.createSuccess'));
      setCreateDialogOpen(false);
      resetForm();
      fetchTasks();
      fetchStats();
    } catch (err) {
      toast.error(t('aiScheduledTasks.createFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 更新任务
  const handleUpdate = async () => {
    if (!selectedTask) return;
    try {
      setIsSaving(true);
      await aiScheduledTasksApi.updateTask(selectedTask.task_id, {
        task_prompt: formData.task_prompt,
        max_executions: formData.max_executions,
      });
      toast.success(t('aiScheduledTasks.updateSuccess'));
      setEditDialogOpen(false);
      setSelectedTask(null);
      resetForm();
      fetchTasks();
    } catch (err) {
      toast.error(t('aiScheduledTasks.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  // 重置表单
  const resetForm = () => {
    setFormData({
      task_type: 'interval',
      interval_type: 'minutes',
      interval_value: 30,
      task_prompt: '',
      max_executions: undefined,
      run_time: undefined,
    });
  };

  // 打开编辑弹窗
  const openEditDialog = (task: AIScheduledTask) => {
    setSelectedTask(task);
    setFormData({
      task_type: task.task_type,
      task_prompt: task.task_prompt,
      max_executions: task.max_executions,
      interval_type: 'minutes',
      interval_value: task.interval_seconds / 60,
    });
    setEditDialogOpen(true);
  };

  // 打开详情弹窗
  const openDetailDialog = (task: AIScheduledTask) => {
    setSelectedTask(task);
    setDetailDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="w-8 h-8" />
            {t('aiScheduledTasks.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('aiScheduledTasks.description')}</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setCreateDialogOpen(true);
          }}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {t('aiScheduledTasks.createTask')}
        </Button>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Timer className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.totalTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.pendingTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Pause className="w-8 h-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.paused}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.pausedTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.executed}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.executedTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-destructive" />
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.failedTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.interval_count}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.intervalTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.once_count}</p>
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.onceTasks')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 筛选栏 */}
      <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t('aiScheduledTasks.taskPromptPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('aiScheduledTasks.filterByStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiScheduledTasks.all')}</SelectItem>
                  <SelectItem value="pending">{t('aiScheduledTasks.statusPending')}</SelectItem>
                  <SelectItem value="paused">{t('aiScheduledTasks.statusPaused')}</SelectItem>
                  <SelectItem value="executed">{t('aiScheduledTasks.statusExecuted')}</SelectItem>
                  <SelectItem value="failed">{t('aiScheduledTasks.statusFailed')}</SelectItem>
                  <SelectItem value="cancelled">{t('aiScheduledTasks.statusCancelled')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder={t('aiScheduledTasks.filterByType')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiScheduledTasks.all')}</SelectItem>
                  <SelectItem value="once">{t('aiScheduledTasks.taskTypeOnce')}</SelectItem>
                  <SelectItem value="interval">{t('aiScheduledTasks.taskTypeInterval')}</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={fetchTasks}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Card className={cn(
          "border-destructive/50",
          isGlass ? "glass-card" : "border border-border/50"
        )}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 任务列表 */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className={cn(isGlass ? "glass-card" : "border border-border/50")}>
              <CardContent className="p-4">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredTasks.length === 0 ? (
        <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
          <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
            <Clock className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">{t('aiScheduledTasks.noTasks')}</p>
            <p className="text-sm">{t('aiScheduledTasks.noTasksDescription')}</p>
          </CardContent>
        </Card>
      ) : (
        <Card className={cn(isGlass ? "glass-card" : "border border-border/50")}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('aiScheduledTasks.taskPrompt')}</TableHead>
                  <TableHead className="hidden md:table-cell">{t('aiScheduledTasks.taskType')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('aiScheduledTasks.status')}</TableHead>
                  <TableHead className="hidden lg:table-cell">{t('aiScheduledTasks.nextRunTime')}</TableHead>
                  <TableHead className="text-right">{t('aiScheduledTasks.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow
                    key={task.task_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openDetailDialog(task)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium truncate max-w-[300px]">{task.task_prompt}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {task.task_id}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline">
                        {task.task_type === 'interval' 
                          ? t('aiScheduledTasks.taskTypeInterval')
                          : t('aiScheduledTasks.taskTypeOnce')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {getStatusBadge(task.status)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-sm">
                        {task.next_run_time
                          ? format(new Date(task.next_run_time), 'MM-dd HH:mm', { locale: zhCN })
                          : '-'}
                      </div>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {task.status === 'pending' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePause(task)}
                            title={t('aiScheduledTasks.pause')}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        )}
                        {task.status === 'paused' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleResume(task)}
                            title={t('aiScheduledTasks.resume')}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(task)}
                          title={t('aiScheduledTasks.edit')}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedTask(task);
                            setDeleteDialogOpen(true);
                          }}
                          title={t('aiScheduledTasks.delete')}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* 创建任务弹窗 */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {t('aiScheduledTasks.createTask')}
            </DialogTitle>
            <DialogDescription>{t('aiScheduledTasks.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('aiScheduledTasks.taskType')}</Label>
              <Select
                value={formData.task_type}
                onValueChange={(value: 'once' | 'interval') => setFormData({ ...formData, task_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="interval">{t('aiScheduledTasks.taskTypeInterval')}</SelectItem>
                  <SelectItem value="once">{t('aiScheduledTasks.taskTypeOnce')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.task_type === 'interval' ? (
              <>
                <div className="space-y-2">
                  <Label>{t('aiScheduledTasks.interval')}</Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.interval_type}
                      onValueChange={(value: 'minutes' | 'hours' | 'days') => 
                        setFormData({ ...formData, interval_type: value })}
                    >
                      <SelectTrigger className="w-[120px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">{t('aiScheduledTasks.intervalMinutes').replace('{minutes}', '')}</SelectItem>
                        <SelectItem value="hours">{t('aiScheduledTasks.intervalHours').replace('{hours}', '')}</SelectItem>
                        <SelectItem value="days">{t('aiScheduledTasks.intervalDays').replace('{days}', '')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min={1}
                      value={formData.interval_value}
                      onChange={(e) => setFormData({ ...formData, interval_value: parseInt(e.target.value) || 1 })}
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('aiScheduledTasks.maxExecutions')}</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder={t('aiScheduledTasks.maxExecutionsPlaceholder')}
                    value={formData.max_executions || ''}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      max_executions: e.target.value ? parseInt(e.target.value) : undefined 
                    })}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>{t('aiScheduledTasks.runTime')}</Label>
                <Input
                  type="datetime-local"
                  value={formData.run_time?.replace(' ', 'T') || ''}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    run_time: e.target.value ? e.target.value.replace('T', ' ') + ':00' : undefined 
                  })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('aiScheduledTasks.taskPrompt')}</Label>
              <Textarea
                placeholder={t('aiScheduledTasks.taskPromptPlaceholder')}
                value={formData.task_prompt}
                onChange={(e) => setFormData({ ...formData, task_prompt: e.target.value })}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('aiScheduledTasks.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={isSaving || !formData.task_prompt}>
              {isSaving ? t('aiScheduledTasks.saving') : t('aiScheduledTasks.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑任务弹窗 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              {t('aiScheduledTasks.editTask')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('aiScheduledTasks.taskPrompt')}</Label>
              <Textarea
                placeholder={t('aiScheduledTasks.taskPromptPlaceholder')}
                value={formData.task_prompt}
                onChange={(e) => setFormData({ ...formData, task_prompt: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('aiScheduledTasks.maxExecutions')}</Label>
              <Input
                type="number"
                min={1}
                placeholder={t('aiScheduledTasks.maxExecutionsPlaceholder')}
                value={formData.max_executions || ''}
                onChange={(e) => setFormData({ 
                  ...formData, 
                  max_executions: e.target.value ? parseInt(e.target.value) : undefined 
                })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('aiScheduledTasks.cancel')}
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving || !formData.task_prompt}>
              {isSaving ? t('aiScheduledTasks.saving') : t('aiScheduledTasks.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 任务详情弹窗 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              {t('aiScheduledTasks.view')}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.status')}</p>
                  {getStatusBadge(selectedTask.status)}
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.taskType')}</p>
                  <Badge variant="outline">
                    {selectedTask.task_type === 'interval'
                      ? t('aiScheduledTasks.taskTypeInterval')
                      : t('aiScheduledTasks.taskTypeOnce')}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.createdAt')}</p>
                  <p className="text-sm">
                    {format(new Date(selectedTask.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.nextRunTime')}</p>
                  <p className="text-sm">
                    {selectedTask.next_run_time
                      ? format(new Date(selectedTask.next_run_time), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })
                      : '-'}
                  </p>
                </div>
                {selectedTask.task_type === 'interval' && (
                  <>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.interval')}</p>
                      <p className="text-sm">{formatInterval(selectedTask.interval_seconds)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.maxExecutions')}</p>
                      <p className="text-sm">
                        {selectedTask.max_executions > 0 
                          ? `${selectedTask.current_executions} / ${selectedTask.max_executions}`
                          : `${selectedTask.current_executions} / ∞`}
                      </p>
                    </div>
                  </>
                )}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.persona')}</p>
                  <p className="text-sm">{selectedTask.persona_name}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.session')}</p>
                  <p className="text-sm font-mono text-xs truncate">{selectedTask.session_id}</p>
                </div>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.taskPrompt')}</p>
                <div className="p-3 bg-muted/50 rounded-md text-sm">
                  {selectedTask.task_prompt}
                </div>
              </div>

              {selectedTask.error_message && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.errorMessage')}</p>
                  <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md text-sm text-destructive">
                    {selectedTask.error_message}
                  </div>
                </div>
              )}

              {selectedTask.result && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t('aiScheduledTasks.result')}</p>
                  <div className="p-3 bg-muted/50 rounded-md text-sm">
                    {selectedTask.result}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                {selectedTask.status === 'pending' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handlePause(selectedTask);
                      setDetailDialogOpen(false);
                    }}
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    {t('aiScheduledTasks.pause')}
                  </Button>
                )}
                {selectedTask.status === 'paused' && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      handleResume(selectedTask);
                      setDetailDialogOpen(false);
                    }}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    {t('aiScheduledTasks.resume')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDetailDialogOpen(false);
                    openEditDialog(selectedTask);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  {t('aiScheduledTasks.edit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t('aiScheduledTasks.confirmDelete')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiScheduledTasks.confirmDeleteMessage')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('aiScheduledTasks.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('aiScheduledTasks.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
