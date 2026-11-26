import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  aiStatisticsApi,
  aiTaskModelsApi,
  getApiErrorMessage,
  type AITaskGraphPos,
  type AITaskGraphSavePayload,
  type AITaskKindInfo,
  type AITaskModelsData,
  type AllConfigItem,
} from '@/lib/api';
import {
  CAPABILITY_AGENT_TASK_ID,
  CAPABILITY_AGENT_TASK_PREFIX,
  resolveHierarchyParentTaskId,
} from '@/lib/aiTaskKinds';
import {
  buildDefaultTwoHubDraft,
  findUnconfiguredConnectedHubIds,
  materializeGraphPositions,
  rearrangeGraphPositions,
  serializeGraphSignature,
  synthesizeGraphFromTaskModels,
  type StarUsageMetric,
  type TaskUsageBucket,
} from '../graph/starGraphModel';

const USAGE_WINDOW_DAYS = 30;
const MAX_UNDO_STEPS = 50;

function cloneGraph(graph: AITaskGraphSavePayload): AITaskGraphSavePayload {
  return {
    nodes: graph.nodes.map((n) => ({
      id: n.id,
      primary: n.primary,
      secondary: n.secondary,
      role: n.role,
      pos: n.pos ? { x: n.pos.x, y: n.pos.y } : null,
    })),
    edges: { ...graph.edges },
    split_subagents: [...graph.split_subagents],
    task_positions: Object.fromEntries(
      Object.entries(graph.task_positions).map(([k, p]) => [k, { x: p.x, y: p.y }]),
    ),
  };
}

export interface UseTaskGraphConfigReturn {
  data: AITaskModelsData | null;
  kinds: AITaskKindInfo[];
  draftGraph: AITaskGraphSavePayload | null;
  savedGraph: AITaskGraphSavePayload | null;
  isLoading: boolean;
  loadError: string;
  usageByStatKey: ReadonlyMap<string, TaskUsageBucket>;
  usageMetric: StarUsageMetric;
  expandedParentIds: ReadonlySet<string>;
  isGraphDirty: boolean;
  canUndo: boolean;
  unconfiguredHubIds: string[];
  /** 旧版 Core 不下发 graph 字段，意味着 PUT /graph 也不存在：编辑可草稿化但无法保存 */
  isGraphUnsupported: boolean;
  setUsageMetric: (metric: StarUsageMetric) => void;
  toggleExpandParent: (parentTaskId: string, force?: boolean) => void;
  reload: () => Promise<void>;
  recordUndoCheckpoint: () => void;
  undo: () => boolean;
  addHubNode: (primaryFullName?: string) => string;
  assignHubPrimary: (nodeId: string, primaryFullName: string) => void;
  assignHubSecondary: (nodeId: string, secondaryFullName: string) => void;
  removeHubNode: (nodeId: string, migrateTargetNodeId?: string) => void;
  connectTaskToHub: (
    taskId: string,
    targetNodeId: string,
    parkedPos?: AITaskGraphPos,
    skipUndoPush?: boolean,
  ) => void;
  connectTasksBatchToHub: (
    taskIds: readonly string[],
    targetNodeId: string,
    parkedPositions?: Readonly<Record<string, AITaskGraphPos>>,
    skipUndoPush?: boolean,
  ) => void;
  reattachChildToParent: (childTaskId: string, skipUndoPush?: boolean) => void;
  moveHubWithFollowers: (
    nodeId: string,
    hubPos: AITaskGraphPos,
    followerPositions: Readonly<Record<string, AITaskGraphPos>>,
  ) => void;
  updateTaskPosition: (taskId: string, pos: AITaskGraphPos) => void;
  clearTransientChildPosition: (taskId: string) => void;
  moveTasksBatch: (positions: Readonly<Record<string, AITaskGraphPos>>) => void;
  commitProjectedLayout: (
    hubPositions: Readonly<Record<string, AITaskGraphPos>>,
    taskPositions: Readonly<Record<string, AITaskGraphPos>>,
  ) => void;
  rearrangeLayout: (isNarrow?: boolean) => void;
  resetToDefaultTwoHubs: () => void;
  discardDraftChanges: () => void;
  saveGraph: () => Promise<{ ok: boolean; errorMsg?: string }>;
  /** 点击 '+' 占位节点触发「新建配置」时记录该星核 ID，新配置落盘后自动填入该星核 */
  markPendingBindHub: (nodeId: string | null) => void;
}

export function useTaskGraphConfig(
  allConfigsList: readonly AllConfigItem[],
  options?: { createDialogOpen?: boolean },
): UseTaskGraphConfigReturn {
  const [data, setData] = useState<AITaskModelsData | null>(null);
  const [savedGraph, setSavedGraph] = useState<AITaskGraphSavePayload | null>(null);
  const [draftGraph, setDraftGraph] = useState<AITaskGraphSavePayload | null>(null);
  const [undoStack, setUndoStack] = useState<AITaskGraphSavePayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isGraphUnsupported, setIsGraphUnsupported] = useState(false);
  const [usageByStatKey, setUsageByStatKey] = useState<Map<string, TaskUsageBucket>>(new Map());
  const [usageMetric, setUsageMetric] = useState<StarUsageMetric>('tokens');
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(() => new Set());

  const draftRef = useRef<AITaskGraphSavePayload | null>(null);
  draftRef.current = draftGraph;

  const pendingBindHubRef = useRef<string | null>(null);
  const prevConfigNamesRef = useRef<Set<string>>(new Set());
  const hubCounterRef = useRef(1);

  const pushSnapshot = useCallback((snapshot: AITaskGraphSavePayload | null) => {
    if (!snapshot) return;
    const copy = cloneGraph(snapshot);
    setUndoStack((prev) => {
      const top = prev[prev.length - 1];
      if (top && serializeGraphSignature(top) === serializeGraphSignature(copy)) {
        return prev;
      }
      const next = [...prev, copy];
      return next.length > MAX_UNDO_STEPS ? next.slice(next.length - MAX_UNDO_STEPS) : next;
    });
  }, []);

  const recordUndoCheckpoint = useCallback(() => {
    pushSnapshot(draftRef.current);
  }, [pushSnapshot]);

  const undo = useCallback((): boolean => {
    let restored: AITaskGraphSavePayload | null = null;
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      restored = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    if (restored) {
      setDraftGraph(cloneGraph(restored));
      return true;
    }
    return false;
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await aiTaskModelsApi.list();
      setData(res);
      setIsGraphUnsupported(!res.graph);
      const initialNarrow = typeof window !== 'undefined' && window.innerWidth < 768;
      const synthesized = materializeGraphPositions({
        graph: synthesizeGraphFromTaskModels(res),
        kinds: res.kinds ?? [],
        isNarrow: initialNarrow,
      });
      setSavedGraph(cloneGraph(synthesized));
      setDraftGraph(cloneGraph(synthesized));
      setUndoStack([]);
      setLoadError('');
    } catch (err) {
      setLoadError(getApiErrorMessage(err, 'Failed to load task models'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    const today = new Date();
    void aiStatisticsApi
      .getTokenByRange(
        format(subDays(today, USAGE_WINDOW_DAYS - 1), 'yyyy-MM-dd'),
        format(today, 'yyyy-MM-dd'),
      )
      .then((res) => {
        if (cancelled) return;
        const next = new Map<string, TaskUsageBucket>();
        for (const row of res.by_type ?? []) {
          const key = row.type.toLowerCase();
          const prev = next.get(key) ?? { tokens: 0, requests: 0 };
          next.set(key, {
            tokens: prev.tokens + (row.total_tokens ?? 0),
            requests: prev.requests + (row.request_count ?? 0),
          });
        }
        setUsageByStatKey(next);
      })
      .catch(() => {
        // 统计接口不可用时仅按最小保底尺寸展示节点，不阻塞图谱编辑
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const currentNames = new Set(allConfigsList.map((c) => c.name));
    const pendingHubId = pendingBindHubRef.current;
    if (pendingHubId && currentNames.size > prevConfigNamesRef.current.size) {
      const newlyCreated = allConfigsList.find((c) => !prevConfigNamesRef.current.has(c.name));
      if (newlyCreated) {
        pendingBindHubRef.current = null;
        pushSnapshot(draftRef.current);
        setDraftGraph((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === pendingHubId
                ? {
                    ...n,
                    primary: newlyCreated.name,
                    secondary: n.secondary === newlyCreated.name ? '' : n.secondary,
                  }
                : n,
            ),
          };
        });
      }
    }
    prevConfigNamesRef.current = currentNames;
  }, [allConfigsList, pushSnapshot]);

  // 新建对话框关闭时若 pending 绑定仍未被上面的 effect 消费，说明用户取消了创建，
  // 必须清掉，否则下一次任意渠道新建的配置会被绑到过期星核上。
  // 成功路径无竞态的前提是：创建流程先 await 刷新配置列表、再关闭对话框
  // （见 useProviderConfig.handleCreateConfig），且本 effect 声明在绑定 effect 之后。
  const createDialogOpen = options?.createDialogOpen ?? false;
  const prevCreateDialogOpenRef = useRef(false);
  useEffect(() => {
    if (prevCreateDialogOpenRef.current && !createDialogOpen) {
      pendingBindHubRef.current = null;
    }
    prevCreateDialogOpenRef.current = createDialogOpen;
  }, [createDialogOpen]);

  const markPendingBindHub = useCallback((nodeId: string | null) => {
    pendingBindHubRef.current = nodeId;
  }, []);

  const kinds = useMemo(() => data?.kinds ?? [], [data]);

  const toggleExpandParent = useCallback((parentTaskId: string, force?: boolean) => {
    setExpandedParentIds((prev) => {
      const next = new Set(prev);
      const shouldExpand = force !== undefined ? force : !next.has(parentTaskId);
      if (shouldExpand) {
        next.add(parentTaskId);
      } else {
        next.delete(parentTaskId);
      }
      return next;
    });
  }, []);

  const isGraphDirty = useMemo(() => {
    if (!draftGraph || !savedGraph) return false;
    return serializeGraphSignature(draftGraph) !== serializeGraphSignature(savedGraph);
  }, [draftGraph, savedGraph]);

  const unconfiguredHubIds = useMemo(() => {
    if (!draftGraph) return [];
    return findUnconfiguredConnectedHubIds(draftGraph, kinds);
  }, [draftGraph, kinds]);

  const addHubNode = useCallback(
    (primaryFullName = ''): string => {
      pushSnapshot(draftRef.current);
      // 候选 id 必须在 setState 之外同步算出：updater 不保证同步执行，
      // 且在 updater 内自增计数器属于副作用（StrictMode 双调用会产生不一致 id）
      const existingIds = new Set((draftRef.current?.nodes ?? []).map((n) => n.id));
      let candidate = `hub_${hubCounterRef.current}`;
      while (existingIds.has(candidate)) {
        hubCounterRef.current += 1;
        candidate = `hub_${hubCounterRef.current}`;
      }
      hubCounterRef.current += 1;
      const createdId = candidate;
      const isNarrowNow = typeof window !== 'undefined' && window.innerWidth < 768;
      setDraftGraph((prev) => {
        if (!prev) return prev;
        return materializeGraphPositions({
          graph: {
            ...prev,
            nodes: [
              ...prev.nodes,
              {
                id: createdId,
                primary: primaryFullName,
                secondary: '',
                role: 'custom',
                pos: null,
              },
            ],
          },
          kinds,
          usageByStatKey,
          metric: usageMetric,
          isNarrow: isNarrowNow,
        });
      });
      return createdId;
    },
    [kinds, pushSnapshot, usageByStatKey, usageMetric],
  );

  const assignHubPrimary = useCallback(
    (nodeId: string, primaryFullName: string) => {
      pushSnapshot(draftRef.current);
      setDraftGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  primary: primaryFullName,
                  secondary: !primaryFullName || n.secondary === primaryFullName ? '' : n.secondary,
                }
              : n,
          ),
        };
      });
    },
    [pushSnapshot],
  );

  const assignHubSecondary = useCallback(
    (nodeId: string, secondaryFullName: string) => {
      pushSnapshot(draftRef.current);
      setDraftGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId && n.primary && secondaryFullName !== n.primary
              ? { ...n, secondary: secondaryFullName }
              : n.id === nodeId && !secondaryFullName
                ? { ...n, secondary: '' }
                : n,
          ),
        };
      });
    },
    [pushSnapshot],
  );

  const removeHubNode = useCallback(
    (nodeId: string, migrateTargetNodeId?: string) => {
      pushSnapshot(draftRef.current);
      setDraftGraph((prev) => {
        if (!prev || prev.nodes.length <= 1) return prev;
        const remaining = prev.nodes.filter((n) => n.id !== nodeId);
        if (remaining.length === 0) return prev;
        const fallbackId =
          migrateTargetNodeId && remaining.some((n) => n.id === migrateTargetNodeId)
            ? migrateTargetNodeId
            : remaining[0].id;
        const nextEdges: Record<string, string> = {};
        for (const [tk, target] of Object.entries(prev.edges)) {
          nextEdges[tk] = target === nodeId ? fallbackId : target;
        }
        return {
          ...prev,
          nodes: remaining,
          edges: nextEdges,
        };
      });
    },
    [pushSnapshot],
  );

  const connectTaskToHub = useCallback(
    (taskId: string, targetNodeId: string, parkedPos?: AITaskGraphPos, skipUndoPush = false) => {
      if (!skipUndoPush) {
        pushSnapshot(draftRef.current);
      }
      setDraftGraph((prev) => {
        if (!prev?.nodes.some((n) => n.id === targetNodeId)) return prev;
        const nextEdges = { ...prev.edges, [taskId]: targetNodeId };
        const nextSplit = [...prev.split_subagents];
        const nextTaskPositions = { ...prev.task_positions };

        if (parkedPos) {
          nextTaskPositions[taskId] = {
            x: Math.round(parkedPos.x),
            y: Math.round(parkedPos.y),
          };
        }

        if (taskId.startsWith(CAPABILITY_AGENT_TASK_PREFIX) && !nextSplit.includes(taskId)) {
          nextSplit.push(taskId);
        }

        const highRole = prev.nodes.find((n) => n.role === 'high')?.id ?? prev.nodes[0]?.id ?? '';
        const lowRole = prev.nodes.find((n) => n.role === 'low')?.id ?? prev.nodes[0]?.id ?? '';
        const targetKind = kinds.find((k) => k.id === taskId);
        if (targetKind && resolveHierarchyParentTaskId(targetKind) === null) {
          const prevParentHub =
            prev.edges[taskId] || (targetKind.default_level === 'high' ? highRole : lowRole);
          for (const candidate of kinds) {
            if (candidate.parent_id === CAPABILITY_AGENT_TASK_ID) continue;
            if (resolveHierarchyParentTaskId(candidate) !== taskId) continue;
            const childPrevHub =
              prev.edges[candidate.id] || (candidate.default_level === 'high' ? highRole : lowRole);
            if (childPrevHub === prevParentHub) {
              nextEdges[candidate.id] = targetNodeId;
            }
          }
        }

        return {
          ...prev,
          edges: nextEdges,
          split_subagents: nextSplit,
          task_positions: nextTaskPositions,
        };
      });
    },
    [kinds, pushSnapshot],
  );

  const connectTasksBatchToHub = useCallback(
    (
      taskIds: readonly string[],
      targetNodeId: string,
      parkedPositions?: Readonly<Record<string, AITaskGraphPos>>,
      skipUndoPush = false,
    ) => {
      if (taskIds.length === 0) return;
      if (!skipUndoPush) {
        pushSnapshot(draftRef.current);
      }
      setDraftGraph((prev) => {
        if (!prev?.nodes.some((n) => n.id === targetNodeId)) return prev;
        const selectedSet = new Set(taskIds);
        const nextEdges = { ...prev.edges };
        const nextSplit = [...prev.split_subagents];
        const nextTaskPositions = { ...prev.task_positions };

        if (parkedPositions) {
          for (const [id, p] of Object.entries(parkedPositions)) {
            nextTaskPositions[id] = { x: Math.round(p.x), y: Math.round(p.y) };
          }
        }

        const highRole = prev.nodes.find((n) => n.role === 'high')?.id ?? prev.nodes[0]?.id ?? '';
        const lowRole = prev.nodes.find((n) => n.role === 'low')?.id ?? prev.nodes[0]?.id ?? '';

        for (const taskId of taskIds) {
          nextEdges[taskId] = targetNodeId;
          if (taskId.startsWith(CAPABILITY_AGENT_TASK_PREFIX) && !nextSplit.includes(taskId)) {
            nextSplit.push(taskId);
          }

          const targetKind = kinds.find((k) => k.id === taskId);
          if (targetKind && resolveHierarchyParentTaskId(targetKind) === null) {
            const prevParentHub =
              prev.edges[taskId] || (targetKind.default_level === 'high' ? highRole : lowRole);
            for (const candidate of kinds) {
              if (selectedSet.has(candidate.id)) continue;
              if (candidate.parent_id === CAPABILITY_AGENT_TASK_ID) continue;
              if (resolveHierarchyParentTaskId(candidate) !== taskId) continue;
              const childPrevHub =
                prev.edges[candidate.id] ||
                (candidate.default_level === 'high' ? highRole : lowRole);
              if (childPrevHub === prevParentHub) {
                nextEdges[candidate.id] = targetNodeId;
              }
            }
          }
        }

        return {
          ...prev,
          edges: nextEdges,
          split_subagents: nextSplit,
          task_positions: nextTaskPositions,
        };
      });
    },
    [kinds, pushSnapshot],
  );

  const reattachChildToParent = useCallback(
    (childTaskId: string, skipUndoPush = false) => {
      if (!skipUndoPush) {
        pushSnapshot(draftRef.current);
      }
      setDraftGraph((prev) => {
        if (!prev) return prev;
        const nextEdges = { ...prev.edges };
        const nextTaskPositions = { ...prev.task_positions };
        delete nextTaskPositions[childTaskId];

        if (childTaskId.startsWith(CAPABILITY_AGENT_TASK_PREFIX)) {
          delete nextEdges[childTaskId];
          return {
            ...prev,
            edges: nextEdges,
            split_subagents: prev.split_subagents.filter((id) => id !== childTaskId),
            task_positions: nextTaskPositions,
          };
        }

        const childKind = kinds.find((k) => k.id === childTaskId);
        const parentId = childKind ? resolveHierarchyParentTaskId(childKind) : null;
        if (parentId) {
          const highRole = prev.nodes.find((n) => n.role === 'high')?.id ?? prev.nodes[0]?.id ?? '';
          const lowRole = prev.nodes.find((n) => n.role === 'low')?.id ?? prev.nodes[0]?.id ?? '';
          const parentKind = kinds.find((k) => k.id === parentId);
          const parentHub =
            prev.edges[parentId] || (parentKind?.default_level === 'low' ? lowRole : highRole);
          if (parentHub) {
            nextEdges[childTaskId] = parentHub;
          }
        }

        return {
          ...prev,
          edges: nextEdges,
          task_positions: nextTaskPositions,
        };
      });
    },
    [kinds, pushSnapshot],
  );

  const moveHubWithFollowers = useCallback(
    (
      nodeId: string,
      hubPos: AITaskGraphPos,
      followerPositions: Readonly<Record<string, AITaskGraphPos>>,
    ) => {
      setDraftGraph((prev) => {
        if (!prev) return prev;
        const nextTaskPositions = { ...prev.task_positions };
        for (const [tid, p] of Object.entries(followerPositions)) {
          nextTaskPositions[tid] = { x: Math.round(p.x), y: Math.round(p.y) };
        }
        return {
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, pos: { x: Math.round(hubPos.x), y: Math.round(hubPos.y) } }
              : n,
          ),
          task_positions: nextTaskPositions,
        };
      });
    },
    [],
  );

  const updateTaskPosition = useCallback((taskId: string, pos: AITaskGraphPos) => {
    setDraftGraph((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        task_positions: {
          ...prev.task_positions,
          [taskId]: { x: Math.round(pos.x), y: Math.round(pos.y) },
        },
      };
    });
  }, []);

  const clearTransientChildPosition = useCallback((taskId: string) => {
    setDraftGraph((prev) => {
      if (!prev || !(taskId in prev.task_positions)) return prev;
      const nextTaskPositions = { ...prev.task_positions };
      delete nextTaskPositions[taskId];
      return {
        ...prev,
        task_positions: nextTaskPositions,
      };
    });
  }, []);

  const moveTasksBatch = useCallback((positions: Readonly<Record<string, AITaskGraphPos>>) => {
    setDraftGraph((prev) => {
      if (!prev) return prev;
      const nextTaskPositions = { ...prev.task_positions };
      for (const [tid, p] of Object.entries(positions)) {
        nextTaskPositions[tid] = { x: Math.round(p.x), y: Math.round(p.y) };
      }
      return {
        ...prev,
        task_positions: nextTaskPositions,
      };
    });
  }, []);

  const commitProjectedLayout = useCallback(
    (
      hubPositions: Readonly<Record<string, AITaskGraphPos>>,
      taskPositions: Readonly<Record<string, AITaskGraphPos>>,
    ) => {
      setDraftGraph((prev) => {
        if (!prev) return prev;
        const nextTaskPositions = { ...prev.task_positions };
        for (const [tid, p] of Object.entries(taskPositions)) {
          nextTaskPositions[tid] = { x: Math.round(p.x), y: Math.round(p.y) };
        }
        return {
          ...prev,
          nodes: prev.nodes.map((n) => {
            const p = hubPositions[n.id];
            return p ? { ...n, pos: { x: Math.round(p.x), y: Math.round(p.y) } } : n;
          }),
          task_positions: nextTaskPositions,
        };
      });
    },
    [],
  );

  const rearrangeLayout = useCallback(
    (isNarrow = false) => {
      pushSnapshot(draftRef.current);
      setDraftGraph((prev) => {
        if (!prev) return prev;
        return rearrangeGraphPositions({
          graph: prev,
          kinds,
          usageByStatKey,
          metric: usageMetric,
          isNarrow,
        });
      });
    },
    [kinds, pushSnapshot, usageByStatKey, usageMetric],
  );

  const resetToDefaultTwoHubs = useCallback(() => {
    pushSnapshot(draftRef.current);
    setExpandedParentIds(new Set());
    const isNarrowNow = typeof window !== 'undefined' && window.innerWidth < 768;
    setDraftGraph((prev) => {
      if (!prev) return prev;
      return materializeGraphPositions({
        graph: buildDefaultTwoHubDraft(prev, kinds),
        kinds,
        usageByStatKey,
        metric: usageMetric,
        isNarrow: isNarrowNow,
      });
    });
  }, [kinds, pushSnapshot, usageByStatKey, usageMetric]);

  const discardDraftChanges = useCallback(() => {
    if (!savedGraph) return;
    pushSnapshot(draftRef.current);
    setDraftGraph(cloneGraph(savedGraph));
  }, [pushSnapshot, savedGraph]);

  const saveGraph = useCallback(async (): Promise<{ ok: boolean; errorMsg?: string }> => {
    if (!draftGraph) return { ok: true };
    try {
      const updated = await aiTaskModelsApi.saveGraph(draftGraph);
      if (updated.kinds && updated.kinds.length > 0) {
        setData(updated);
        const isNarrowNow = typeof window !== 'undefined' && window.innerWidth < 768;
        const nextGraph = materializeGraphPositions({
          graph: synthesizeGraphFromTaskModels(updated),
          kinds: updated.kinds,
          usageByStatKey,
          metric: usageMetric,
          isNarrow: isNarrowNow,
        });
        setSavedGraph(cloneGraph(nextGraph));
        setDraftGraph(cloneGraph(nextGraph));
      } else {
        setSavedGraph(cloneGraph(draftGraph));
      }
      setUndoStack([]);
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        errorMsg: getApiErrorMessage(err, 'Failed to save task routing graph'),
      };
    }
  }, [draftGraph, usageByStatKey, usageMetric]);

  return {
    data,
    kinds,
    draftGraph,
    savedGraph,
    isLoading,
    loadError,
    usageByStatKey,
    usageMetric,
    expandedParentIds,
    isGraphDirty,
    canUndo: undoStack.length > 0,
    unconfiguredHubIds,
    isGraphUnsupported,
    setUsageMetric,
    toggleExpandParent,
    reload,
    recordUndoCheckpoint,
    undo,
    addHubNode,
    assignHubPrimary,
    assignHubSecondary,
    removeHubNode,
    connectTaskToHub,
    connectTasksBatchToHub,
    reattachChildToParent,
    moveHubWithFollowers,
    updateTaskPosition,
    clearTransientChildPosition,
    moveTasksBatch,
    commitProjectedLayout,
    rearrangeLayout,
    resetToDefaultTwoHubs,
    discardDraftChanges,
    saveGraph,
    markPendingBindHub,
  };
}
