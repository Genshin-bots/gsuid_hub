/**
 * /ai-debug — Agent 可视化调试台
 *
 * 三栏合一：
 *  - 记忆图谱（Edge 列表 + 软删除 + 冲突列表）
 *  - Agent 任务（任务列表 + 详情 + 中止）
 *  - Persona 自我模型（self_model 加载 + 字段覆盖保存）
 *
 * 涉及的 SKILL 章节：
 *  - [§04 排版铁律 · PinnedPage + toolbar](../../docs/skills/gshub-development/references/04-page-layout-spec.md)
 *  - [§06 组件目录 · TabButtonGroup](../../docs/skills/gshub-development/references/06-reusable-component-catalog.md)
 *  - [§10 已知坑 · 错误 toast 回显后端 detail](../../docs/skills/gshub-development/references/10-pitfalls-and-performance.md) P-13
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Brain,
  Bug,
  ListChecks,
  Save,
  ShieldAlert,
  Skull,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { Textarea } from '@/components/ui/textarea';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { PinnedPage } from '@/components/layout/PinnedPage';
import {
  agentDebugApi,
  memoryApi,
  getApiErrorMessage,
  type AgentDebugMemoryEdge,
  type AgentDebugMemoryConflict,
  type AgentDebugTaskListItem,
  type AgentDebugTaskDetail,
} from '@/lib/api';

const SCOPE_SENTINEL = '__all__';
const DEFAULT_BOT = 'default';

const SELF_MODEL_FIELDS = ['commitments', 'preferences', 'reflections'] as const;
type SelfModelField = (typeof SELF_MODEL_FIELDS)[number];

export default function AIDebugPage() {
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState('memoryGraph');
  const [scopes, setScopes] = useState<Array<{ scope_key: string }>>([]);
  const [scopeKey, setScopeKey] = useState<string>(SCOPE_SENTINEL);
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [edges, setEdges] = useState<AgentDebugMemoryEdge[]>([]);
  const [conflicts, setConflicts] = useState<AgentDebugMemoryConflict[]>([]);
  const [loading, setLoading] = useState({ edges: false, conflicts: false });

  // Orchestration
  const [tasks, setTasks] = useState<AgentDebugTaskListItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [taskDetail, setTaskDetail] = useState<AgentDebugTaskDetail | null>(null);
  const [loadingTasks, setLoadingTasks] = useState({ list: false, detail: false });

  // Self-model
  const [selfModel, setSelfModel] = useState<Record<string, unknown> | null>(null);
  const [editField, setEditField] = useState<SelfModelField>('commitments');
  const [editItems, setEditItems] = useState('');
  const [savingSelfModel, setSavingSelfModel] = useState(false);

  // load scopes
  useEffect(() => {
    (async () => {
      try {
        const data = await memoryApi.getScopes();
        const list = (data as unknown as Array<{ scope_key: string }>) ?? [];
        setScopes(list);
        if (list[0]?.scope_key) setScopeKey(list[0].scope_key);
      } catch (e) {
        console.warn('[AIDebug] load scopes failed:', e);
      }
    })();
  }, []);

  // Memory Graph
  const loadEdges = async (key: string, withInv: boolean) => {
    if (!key || key === SCOPE_SENTINEL) {
      setEdges([]);
      return;
    }
    setLoading((p) => ({ ...p, edges: true }));
    try {
      const data = await agentDebugApi.getMemoryEdges({
        scope_key: key,
        include_invalid: withInv,
        limit: 200,
      });
      setEdges(data as unknown as AgentDebugMemoryEdge[]);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.memoryGraph.loadEdgesFailed')));
    } finally {
      setLoading((p) => ({ ...p, edges: false }));
    }
  };

  const loadConflicts = async (key: string) => {
    if (!key || key === SCOPE_SENTINEL) {
      setConflicts([]);
      return;
    }
    setLoading((p) => ({ ...p, conflicts: true }));
    try {
      const data = await agentDebugApi.getMemoryConflicts({
        scope_key: key,
        limit: 200,
      });
      setConflicts(data as unknown as AgentDebugMemoryConflict[]);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.memoryGraph.loadConflictsFailed')));
    } finally {
      setLoading((p) => ({ ...p, conflicts: false }));
    }
  };

  useEffect(() => {
    if (activeTab !== 'memoryGraph') return;
    loadEdges(scopeKey, includeInvalid);
    loadConflicts(scopeKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scopeKey, includeInvalid]);

  // Orchestration
  const loadTasks = async () => {
    setLoadingTasks((p) => ({ ...p, list: true }));
    try {
      const data = await agentDebugApi.listTasks({ limit: 200 });
      setTasks(data as unknown as AgentDebugTaskListItem[]);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.orchestration.loadTasksFailed')));
    } finally {
      setLoadingTasks((p) => ({ ...p, list: false }));
    }
  };

  useEffect(() => {
    if (activeTab === 'orchestration') loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const loadDetail = async (id: string) => {
    setLoadingTasks((p) => ({ ...p, detail: true }));
    try {
      const data = await agentDebugApi.getTask(id);
      setTaskDetail(data as unknown as AgentDebugTaskDetail);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.orchestration.loadDetailFailed')));
    } finally {
      setLoadingTasks((p) => ({ ...p, detail: false }));
    }
  };

  useEffect(() => {
    if (selectedTaskId) loadDetail(selectedTaskId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTaskId]);

  const abortTask = async () => {
    if (!selectedTaskId) return;
    try {
      await agentDebugApi.abortTask(selectedTaskId);
      toast.success(t('aiDebug.orchestration.abortSuccess'));
      loadTasks();
      loadDetail(selectedTaskId);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.orchestration.killTask')));
    }
  };

  // Self-model
  const loadSelfModel = async () => {
    try {
      const data = await agentDebugApi.getSelfModel(DEFAULT_BOT);
      setSelfModel(data as Record<string, unknown>);
      const arr = (data as Record<string, unknown>)[editField];
      setEditItems(Array.isArray(arr) ? (arr as string[]).join('\n') : '');
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.selfModel.loadFailed')));
    }
  };

  // 切换 self_model 编辑字段时，从已加载的数据里取对应字段填入 textarea，
  // 避免用户误以为在编辑旧字段内容；若尚未加载则保持空。
  useEffect(() => {
    if (!selfModel) return;
    const arr = selfModel[editField];
    setEditItems(Array.isArray(arr) ? (arr as string[]).join('\n') : '');
  }, [editField, selfModel]);

  const saveSelfModel = async () => {
    setSavingSelfModel(true);
    try {
      await agentDebugApi.setSelfModel({
        bot_id: DEFAULT_BOT,
        field: editField,
        items: editItems
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast.success(t('aiDebug.selfModel.savedSuccess'));
      loadSelfModel();
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.selfModel.saveFailed')));
    } finally {
      setSavingSelfModel(false);
    }
  };

  const invalidateEdge = async (edgeId: string) => {
    if (!window.confirm(t('aiDebug.memoryGraph.softDeleteConfirm'))) return;
    try {
      await agentDebugApi.invalidateMemoryEdge(edgeId);
      toast.success(t('aiDebug.memoryGraph.softDelete'));
      loadEdges(scopeKey, includeInvalid);
    } catch (e) {
      toast.error(getApiErrorMessage(e, t('aiDebug.memoryGraph.softDelete')));
    }
  };

  const tabs = useMemo(
    () => [
      { value: 'memoryGraph', label: t('aiDebug.tabs.memoryGraph'), icon: <Brain className="w-4 h-4" /> },
      { value: 'orchestration', label: t('aiDebug.tabs.orchestration'), icon: <ListChecks className="w-4 h-4" /> },
      { value: 'selfModel', label: t('aiDebug.tabs.selfModel'), icon: <Bug className="w-4 h-4" /> },
    ],
    [t],
  );

  return (
    <PinnedPage
      className="gap-6"
      header={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 shrink-0" />
              {t('aiDebug.title')}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('aiDebug.description')}
            </p>
          </div>
        </div>
      }
      toolbar={
        <TabButtonGroup
          options={tabs}
          value={activeTab}
          onValueChange={setActiveTab}
        />
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="memoryGraph" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                {t('aiDebug.tabs.memoryGraph')}
              </CardTitle>
              <CardDescription>
                {t('aiDebug.description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-3">
                {/* scope picker：触发器内的选中值/placeholder 已经自解释（"group:..." /
                    "没有可显示的边"），外面再套 Label 是冗余信息，删掉让一行紧凑。
                    上百个 scope 切换体验：
                    - 触发区固定宽度，长 scope_key 也能放下
                    - 弹层顶部带搜索框（onChange 时内部过滤），百级也能秒定位
                    - 现有 sentinel 「未选中」逻辑保持不变
                    - 不需要复制/清空按钮（这是 picker，不是 config value） */}
                <InputWithDropdown
                  value={scopeKey === SCOPE_SENTINEL ? '' : scopeKey}
                  onChange={(v) => setScopeKey(v || SCOPE_SENTINEL)}
                  options={scopes.map((s) => s.scope_key)}
                  placeholder={t('aiDebug.memoryGraph.noEdges') ?? ''}
                  inputPlaceholder={t('aiDebug.memoryGraph.searchScope') ?? ''}
                  showCopyValueAction={false}
                  showClearValueAction={false}
                  className="h-9 w-[280px] font-mono text-xs"
                />
                {/* h-9 与左侧 InputWithDropdown 触发器同高，
                    items-end 已让两列底对齐 → 视觉中心也对齐。
                    不加 h-9 时 Switch 行默认 ~24px 高，Switch 中心比 Select 中心高 6px。 */}
                <div className="flex items-center gap-2 h-9">
                  <Switch
                    checked={includeInvalid}
                    onCheckedChange={setIncludeInvalid}
                  />
                  <Label>{t('aiDebug.memoryGraph.includeInvalid')}</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t('aiDebug.memoryGraph.edgesTitle')}</CardTitle>
              <CardDescription>
                {t('aiDebug.memoryGraph.edgesDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading.edges ? (
                <Skeleton className="h-24 w-full rounded-md" />
              ) : edges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('aiDebug.memoryGraph.noEdges')}
                </p>
              ) : (
                <div className="space-y-2">
                  {edges.map((edge) => (
                    <div
                      key={edge.id}
                      className="border border-border/40 rounded-lg p-3 flex items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{edge.fact}</p>
                        <p className="text-xs text-muted-foreground">
                          mentions × {edge.mention_count} · decay {edge.decay_score}
                          {edge.invalid_at ? (
                            <Badge variant="destructive" className="ml-2 align-middle">
                              invalidated
                            </Badge>
                          ) : null}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 shrink-0"
                        onClick={() => invalidateEdge(edge.id)}
                        disabled={!!edge.invalid_at}
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('aiDebug.memoryGraph.softDelete')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>{t('aiDebug.memoryGraph.conflictsTitle')}</CardTitle>
              <CardDescription>
                {t('aiDebug.memoryGraph.conflictsDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading.conflicts ? (
                <Skeleton className="h-16 w-full rounded-md" />
              ) : conflicts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t('aiDebug.memoryGraph.noConflicts')}
                </p>
              ) : (
                <ul className="space-y-2">
                  {conflicts.map((c) => (
                    <li
                      key={c.id}
                      className="border border-border/40 rounded-lg p-3 text-sm"
                    >
                      <p className="font-medium">{c.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.fact_signature} · {c.created_at ?? '—'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orchestration" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="w-5 h-5" />
                {t('aiDebug.orchestration.tasksTitle')}
              </CardTitle>
              <CardDescription>
                {t('aiDebug.orchestration.tasksDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTasks.list ? (
                <Skeleton className="h-24 w-full rounded-md" />
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-auto">
                  {tasks.map((tk) => (
                    <button
                      key={tk.id}
                      onClick={() => setSelectedTaskId(tk.id)}
                      className={
                        'w-full text-left border rounded-lg p-3 transition-colors ' +
                        (selectedTaskId === tk.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border/40 hover:border-border/70')
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{tk.node_kind}</Badge>
                        <Badge>{tk.status}</Badge>
                        <span className="font-mono text-xs text-muted-foreground truncate">
                          {tk.id}
                        </span>
                      </div>
                      <p className="text-sm font-medium mt-1">{tk.display_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {tk.agent_profile} · {tk.updated_at ?? '—'}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle>
                {t('aiDebug.orchestration.taskDetailTitle')}
              </CardTitle>
              <CardDescription>
                {selectedTaskId
                  ? selectedTaskId
                  : t('aiDebug.orchestration.noTaskId')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  className="h-9 font-mono"
                  value={selectedTaskId}
                  placeholder={t('aiDebug.orchestration.taskId') ?? ''}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                />
                <Button
                  variant="destructive"
                  className="h-9"
                  onClick={abortTask}
                  disabled={!selectedTaskId}
                >
                  <Skull className="w-4 h-4" />
                  {t('aiDebug.orchestration.killTask')}
                </Button>
              </div>

              {loadingTasks.detail ? (
                <Skeleton className="h-32 w-full rounded-md" />
              ) : taskDetail ? (
                <div className="space-y-3">
                  <div className="border border-border/40 rounded-lg p-3 text-sm">
                    <p className="font-medium">{String(taskDetail.task.display_name ?? '—')}</p>
                    <p className="text-muted-foreground text-xs">
                      {String(taskDetail.task.goal ?? '')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('aiDebug.orchestration.logsTitle')}
                    </p>
                    {(taskDetail.logs ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t('aiDebug.orchestration.noLogs')}
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {(taskDetail.logs ?? []).map((lg, i) => (
                          <li
                            key={i}
                            className="text-xs border border-border/40 rounded px-2 py-1"
                          >
                            <span className="text-muted-foreground mr-2">
                              [{lg.event_type}]
                            </span>
                            {lg.content}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="selfModel" className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bug className="w-5 h-5" />
                {t('aiDebug.selfModel.selfModelTitle')}
              </CardTitle>
              <CardDescription>
                {t('aiDebug.selfModel.selfModelDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <Tabs value={editField} onValueChange={(v) => setEditField(v as SelfModelField)}>
                  <TabsList>
                    {SELF_MODEL_FIELDS.map((f) => (
                      <TabsTrigger key={f} value={f}>
                        {f}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <Button variant="outline" className="h-9" onClick={loadSelfModel}>
                  {t('aiDebug.selfModel.load')}
                </Button>
                <Button className="h-9" onClick={saveSelfModel} disabled={savingSelfModel}>
                  <Save className="w-4 h-4" />
                  {savingSelfModel ? '…' : t('aiDebug.selfModel.save')}
                </Button>
              </div>

              <div className="space-y-2">
                <Label>{t('aiDebug.selfModel.contentLabel')}</Label>
                <Textarea
                  className="min-h-[180px] font-mono text-sm"
                  value={editItems}
                  onChange={(e) => setEditItems(e.target.value)}
                  placeholder={t('aiDebug.selfModel.noContent') ?? ''}
                />
              </div>

              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">完整 self_model JSON</summary>
                <pre className="mt-2 p-3 bg-muted rounded overflow-auto">
                  {JSON.stringify(selfModel, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PinnedPage>
  );
}
