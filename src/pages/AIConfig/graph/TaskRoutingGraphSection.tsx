import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Eraser,
  Expand,
  ListCollapse,
  ListTree,
  Loader2,
  Maximize2,
  MessageSquare,
  Minimize2,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  SquareDashedMousePointer,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GlassAlert } from '@/components/ui/glass-alert';
import { ModelBrandIcon } from '@/components/ui/model-brand-icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { resolveKindTitle } from '@/lib/aiTaskKinds';
import type { AITaskGraphHubNode, AITaskGraphPos, AllConfigItem } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { UseTaskGraphConfigReturn } from '../hooks/useTaskGraphConfig';
import { HUB_CARD_HALF_H, HUB_CARD_HALF_W, StarHubCard } from './StarHubCard';
import { StarSatelliteBubble } from './StarSatelliteBubble';
import {
  computeStarGraphLayout,
  type StarHubLayoutItem,
  type StarSatelliteItem,
  type StarUsageMetric,
} from './starGraphModel';

export interface TaskRoutingGraphSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  graphCtrl: UseTaskGraphConfigReturn;
  allConfigsList: readonly AllConfigItem[];
  onOpenCreateConfig: () => void;
  onOpenEditConfig: (configName: string, provider: string) => void;
}

interface ActiveWireDrag {
  sourceTaskIds: string[];
  currX: number;
  currY: number;
  hoverHubId: string | null;
}

interface ActiveNodeDrag {
  kind: 'hub' | 'satellite';
  id: string;
  parentTaskId: string | null;
  wasAttachedChild: boolean;
  radius: number;
  startClientX: number;
  startClientY: number;
  originX: number;
  originY: number;
  currX: number;
  currY: number;
  /** 拖动配置星核时跟随一起移动的附属任务初始坐标；或多选整体拖拽时的各选中节点初始坐标 */
  companionOrigins: Record<string, AITaskGraphPos>;
  isBatchGroupDrag: boolean;
  needsProjectedCommit: boolean;
  moved: boolean;
}

interface ActiveMarquee {
  startLocalX: number;
  startLocalY: number;
  currLocalX: number;
  currLocalY: number;
  additive: boolean;
  baseSelection: ReadonlySet<string>;
}

const WIRE_SNAP_DIST = 155;

function hasSelectionModifier(e: {
  altKey: boolean;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}): boolean {
  return e.altKey || e.shiftKey || e.ctrlKey || e.metaKey;
}

function rectBoundaryPoint(
  cx: number,
  cy: number,
  halfW: number,
  halfH: number,
  fromX: number,
  fromY: number,
): { x: number; y: number } {
  const dx = fromX - cx;
  const dy = fromY - cy;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x: cx, y: cy - halfH };
  }
  const scaleX = halfW / Math.max(Math.abs(dx), 0.001);
  const scaleY = halfH / Math.max(Math.abs(dy), 0.001);
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: dy * scale + cy };
}

function buildCurvedRayPath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  bendRatio = 0.08,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const bend = Math.min(20, len * bendRatio);
  const nx = (-dy / len) * bend;
  const ny = (dx / len) * bend;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${(mx + nx).toFixed(1)} ${(my + ny).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function pickNonOverlappingPopoverSide(
  sat: StarSatelliteItem,
  hubX: number,
  hubY: number,
): 'top' | 'bottom' | 'left' | 'right' {
  if (!sat.isExpandedParent || sat.childKinds.length === 0) {
    return 'bottom';
  }
  const fanAngle =
    sat.expandedFanAngle !== undefined && sat.expandedFanAngle !== null
      ? sat.expandedFanAngle
      : Math.atan2(sat.y - hubY, sat.x - hubX);
  const sinA = Math.sin(fanAngle);
  const cosA = Math.cos(fanAngle);
  // 只要下方扇区未被展开的子节点占据，默认保持弹出在节点正下方；若子节点在正下方则自动切向对侧
  if (sinA <= 0.28) {
    return 'bottom';
  }
  if (Math.abs(cosA) > 0.5) {
    return cosA > 0 ? 'left' : 'right';
  }
  return 'top';
}

export function TaskRoutingGraphSection({
  t,
  graphCtrl,
  allConfigsList,
  onOpenCreateConfig,
  onOpenEditConfig,
}: TaskRoutingGraphSectionProps) {
  const {
    draftGraph,
    kinds,
    isLoading,
    loadError,
    usageByStatKey,
    usageMetric,
    expandedParentIds,
    isGraphDirty,
    canUndo,
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
    markPendingBindHub,
  } = graphCtrl;

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? Math.max(320, window.innerWidth - 64) : 980,
    height: 560,
  }));
  const [camera, setCamera] = useState({ x: 490, y: 280, zoom: 1 });
  const cameraInitializedRef = useRef(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showAllChildren, setShowAllChildren] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(() => new Set());
  const [marquee, setMarquee] = useState<ActiveMarquee | null>(null);

  const [addHubPopoverOpen, setAddHubPopoverOpen] = useState(false);
  const [openHubPopoverId, setOpenHubPopoverId] = useState<string | null>(null);
  const [openSatPopoverId, setOpenSatPopoverId] = useState<string | null>(null);
  const [hoveredHubId, setHoveredHubId] = useState<string | null>(null);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [removingHubState, setRemovingHubState] = useState<{
    node: AITaskGraphHubNode;
    connectedCount: number;
    migrateTargetId: string;
  } | null>(null);

  const [wireDrag, setWireDrag] = useState<ActiveWireDrag | null>(null);
  const [dropTargetHubId, setDropTargetHubId] = useState<string | null>(null);
  const [dropTargetParentId, setDropTargetParentId] = useState<string | null>(null);
  const [activeDraggingIds, setActiveDraggingIds] = useState<ReadonlySet<string>>(() => new Set());

  const nodeDragRef = useRef<ActiveNodeDrag | null>(null);
  const marqueeRef = useRef<ActiveMarquee | null>(null);
  const panDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    originCamX: number;
    originCamY: number;
    moved: boolean;
  } | null>(null);
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    startDist: number;
    startZoom: number;
    worldMidX: number;
    worldMidY: number;
  } | null>(null);
  const suppressNextClickRef = useRef(false);

  const tr = useCallback(
    (key: string, fallback: string, params?: Record<string, string | number>) => {
      const val = t(key, params);
      return val === key ? fallback : val;
    },
    [t],
  );

  const configByName = useMemo(() => {
    const map = new Map<string, AllConfigItem>();
    for (const item of allConfigsList) {
      map.set(item.name, item);
    }
    return map;
  }, [allConfigsList]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      setViewportSize({ width: rect.width, height: rect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 窄屏判定（<720px 画布宽度对应移动端纵向星系布局，桌面端为横向星系布局）
  const isNarrow = viewportSize.width < 720;
  const prevNarrowRef = useRef(isNarrow);

  const layout = useMemo(() => {
    if (!draftGraph) {
      return {
        hubs: [],
        satellites: [],
        bounds: { minX: -360, maxX: 360, minY: -240, maxY: 240 },
        isOrientationProjected: false,
      };
    }
    return computeStarGraphLayout({
      graph: draftGraph,
      kinds,
      usageByStatKey,
      metric: usageMetric,
      showAllLowFreq: showAllChildren,
      expandedParentIds,
      activeDraggingIds,
      isNarrow,
    });
  }, [
    draftGraph,
    kinds,
    usageByStatKey,
    usageMetric,
    showAllChildren,
    expandedParentIds,
    activeDraggingIds,
    isNarrow,
  ]);

  const fitCameraToBounds = useCallback(() => {
    const { minX, maxX, minY, maxY } = layout.bounds;
    const pad = isNarrow ? 48 : 80;
    const contentW = Math.max(280, maxX - minX + pad);
    const contentH = Math.max(260, maxY - minY + pad);
    const scaleX = viewportSize.width / contentW;
    const scaleY = viewportSize.height / contentH;
    const nextZoom = Math.min(1.15, Math.max(0.38, Math.min(scaleX, scaleY)));
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    setCamera({
      x: viewportSize.width / 2 - centerX * nextZoom,
      y: viewportSize.height / 2 - centerY * nextZoom,
      zoom: Number(nextZoom.toFixed(3)),
    });
  }, [isNarrow, layout.bounds, viewportSize.height, viewportSize.width]);

  useEffect(() => {
    if (!cameraInitializedRef.current && layout.hubs.length > 0 && viewportSize.width > 100) {
      cameraInitializedRef.current = true;
      fitCameraToBounds();
      return;
    }
    if (prevNarrowRef.current !== isNarrow && layout.hubs.length > 0) {
      prevNarrowRef.current = isNarrow;
      fitCameraToBounds();
    }
  }, [fitCameraToBounds, isNarrow, layout.hubs.length, viewportSize.width]);

  // Escape 键退出框选；Ctrl+Z / Cmd+Z 撤回最近一步图谱操作（焦点在输入框时不劫持）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedTaskIds(new Set());
        setIsSelectMode(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
        ) {
          return;
        }
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, undo]);

  // 自动剔除因收起母节点而暂时不在可见列表中的已选子节点 ID
  useEffect(() => {
    setSelectedTaskIds((prev) => {
      if (prev.size === 0) return prev;
      const visibleIds = new Set(layout.satellites.map((s) => s.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [layout.satellites]);

  const clientToWorld = useCallback(
    (clientX: number, clientY: number): AITaskGraphPos => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - camera.x) / camera.zoom,
        y: (clientY - rect.top - camera.y) / camera.zoom,
      };
    },
    [camera.x, camera.y, camera.zoom],
  );

  const localToWorld = useCallback(
    (localX: number, localY: number): AITaskGraphPos => ({
      x: (localX - camera.x) / camera.zoom,
      y: (localY - camera.y) / camera.zoom,
    }),
    [camera.x, camera.y, camera.zoom],
  );

  const findHubCardDropTarget = useCallback(
    (wx: number, wy: number, padX: number, padY: number, radialMax = 0): string | null => {
      let bestId: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const h of layout.hubs) {
        const inRect =
          Math.abs(wx - h.x) <= HUB_CARD_HALF_W + padX &&
          Math.abs(wy - h.y) <= HUB_CARD_HALF_H + padY;
        const d = Math.hypot(wx - h.x, wy - h.y);
        if ((inRect || (radialMax > 0 && d <= radialMax)) && d < bestDist) {
          bestDist = d;
          bestId = h.node.id;
        }
      }
      return bestId;
    },
    [layout.hubs],
  );

  const satById = useMemo(() => {
    const map = new Map<string, StarSatelliteItem>();
    for (const s of layout.satellites) map.set(s.id, s);
    return map;
  }, [layout.satellites]);

  const hubById = useMemo(() => {
    const map = new Map<string, StarHubLayoutItem>();
    for (const h of layout.hubs) map.set(h.node.id, h);
    return map;
  }, [layout.hubs]);

  const hasExpandableParents = useMemo(
    () => layout.satellites.some((s) => s.childKinds.length > 0),
    [layout.satellites],
  );

  const commitCurrentProjectedSnapshot = useCallback(() => {
    const hubPos: Record<string, AITaskGraphPos> = {};
    for (const h of layout.hubs) {
      hubPos[h.node.id] = { x: h.x, y: h.y };
    }
    const satPos: Record<string, AITaskGraphPos> = {};
    for (const s of layout.satellites) {
      if (s.tier === 'core' || s.isDetachedChild || draftGraph?.task_positions[s.id]) {
        satPos[s.id] = { x: s.x, y: s.y };
      }
    }
    commitProjectedLayout(hubPos, satPos);
  }, [commitProjectedLayout, draftGraph?.task_positions, layout.hubs, layout.satellites]);

  const computeNonOverlappingHubParkPos = useCallback(
    (
      hubId: string,
      droppedX: number,
      droppedY: number,
      originX: number,
      originY: number,
      satRadius: number,
      movingIds: ReadonlySet<string>,
      alreadyParked: readonly AITaskGraphPos[] = [],
    ): AITaskGraphPos => {
      const hub = hubById.get(hubId);
      if (!hub) return { x: Math.round(droppedX), y: Math.round(droppedY) };
      const clearW = HUB_CARD_HALF_W + satRadius + 16;
      const clearH = HUB_CARD_HALF_H + satRadius + 18;
      if (Math.abs(droppedX - hub.x) >= clearW || Math.abs(droppedY - hub.y) >= clearH) {
        return { x: Math.round(droppedX), y: Math.round(droppedY) };
      }
      const dx =
        Math.hypot(droppedX - hub.x, droppedY - hub.y) > 8 ? droppedX - hub.x : originX - hub.x;
      const dy =
        Math.hypot(droppedX - hub.x, droppedY - hub.y) > 8 ? droppedY - hub.y : originY - hub.y;
      let angle = Math.abs(dx) < 1 && Math.abs(dy) < 1 ? -Math.PI / 2 : Math.atan2(dy, dx);
      const parkDist = Math.max(HUB_CARD_HALF_W + satRadius + 28, isNarrow ? 142 : 156);

      for (let attempt = 0; attempt < 12; attempt += 1) {
        const tryAngle =
          angle +
          (attempt === 0 ? 0 : (attempt % 2 === 1 ? 1 : -1) * Math.ceil(attempt / 2) * 0.34);
        const px = Math.round(hub.x + Math.cos(tryAngle) * parkDist);
        const py = Math.round(hub.y + Math.sin(tryAngle) * parkDist);
        const collidesExisting = layout.satellites.some(
          (other) =>
            !movingIds.has(other.id) &&
            Math.hypot(other.x - px, other.y - py) < other.radius + satRadius + 12,
        );
        const collidesParked = alreadyParked.some(
          (p) => Math.hypot(p.x - px, p.y - py) < satRadius * 2 + 14,
        );
        if (!collidesExisting && !collidesParked) return { x: px, y: py };
      }
      angle += 0.3;
      return {
        x: Math.round(hub.x + Math.cos(angle) * parkDist),
        y: Math.round(hub.y + Math.sin(angle) * parkDist),
      };
    },
    [hubById, isNarrow, layout.satellites],
  );

  // 全局指针移动与抬起：支持双指缩放、框选多节点、拖动星核带走全部附属节点、单选/多选拖拽改绑与拉线连接
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && activeTouchesRef.current.has(e.pointerId)) {
        activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (activeTouchesRef.current.size >= 2) {
          const pts = Array.from(activeTouchesRef.current.values());
          const p1 = pts[0];
          const p2 = pts[1];
          const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
          const rect = viewportRef.current?.getBoundingClientRect();
          if (rect && dist > 12) {
            const midX = (p1.x + p2.x) / 2 - rect.left;
            const midY = (p1.y + p2.y) / 2 - rect.top;
            if (!pinchStateRef.current) {
              panDragRef.current = null;
              nodeDragRef.current = null;
              setActiveDraggingIds(new Set());
              pinchStateRef.current = {
                startDist: dist,
                startZoom: camera.zoom,
                worldMidX: (midX - camera.x) / camera.zoom,
                worldMidY: (midY - camera.y) / camera.zoom,
              };
            } else {
              const ps = pinchStateRef.current;
              const nextZoom = Math.min(
                1.85,
                Math.max(0.36, ps.startZoom * (dist / Math.max(ps.startDist, 1))),
              );
              setCamera({
                x: midX - ps.worldMidX * nextZoom,
                y: midY - ps.worldMidY * nextZoom,
                zoom: Number(nextZoom.toFixed(3)),
              });
            }
          }
          return;
        }
      }

      const mq = marqueeRef.current;
      if (mq) {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (!rect) return;
        const currLocalX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const currLocalY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
        const nextMq: ActiveMarquee = { ...mq, currLocalX, currLocalY };
        marqueeRef.current = nextMq;
        setMarquee(nextMq);

        const w1 = localToWorld(
          Math.min(mq.startLocalX, currLocalX),
          Math.min(mq.startLocalY, currLocalY),
        );
        const w2 = localToWorld(
          Math.max(mq.startLocalX, currLocalX),
          Math.max(mq.startLocalY, currLocalY),
        );
        const nextSelected = mq.additive ? new Set(mq.baseSelection) : new Set<string>();
        for (const sat of layout.satellites) {
          const pad = sat.radius * 0.55;
          if (
            sat.x + pad >= w1.x &&
            sat.x - pad <= w2.x &&
            sat.y + pad >= w1.y &&
            sat.y - pad <= w2.y
          ) {
            nextSelected.add(sat.id);
          }
        }
        setSelectedTaskIds(nextSelected);
        return;
      }

      if (panDragRef.current) {
        const dx = e.clientX - panDragRef.current.startClientX;
        const dy = e.clientY - panDragRef.current.startClientY;
        if (Math.hypot(dx, dy) >= 4) {
          panDragRef.current.moved = true;
        }
        setCamera((prev) => ({
          ...prev,
          x: panDragRef.current ? panDragRef.current.originCamX + dx : prev.x,
          y: panDragRef.current ? panDragRef.current.originCamY + dy : prev.y,
        }));
        return;
      }

      if (wireDrag) {
        const world = clientToWorld(e.clientX, e.clientY);
        const nearHub = findHubCardDropTarget(world.x, world.y, 28, 28, WIRE_SNAP_DIST);
        setDropTargetHubId(nearHub);
        setWireDrag((prev) =>
          prev
            ? {
                ...prev,
                currX: world.x,
                currY: world.y,
                hoverHubId: nearHub,
              }
            : null,
        );
        return;
      }

      const nd = nodeDragRef.current;
      if (nd) {
        const dx = (e.clientX - nd.startClientX) / camera.zoom;
        const dy = (e.clientY - nd.startClientY) / camera.zoom;
        if (!nd.moved && Math.hypot(dx, dy) < 4) return;
        if (!nd.moved) {
          nd.moved = true;
          // 整段拖拽只压入一次撤回快照，Ctrl+Z 一步回到起拖前状态
          recordUndoCheckpoint();
          if (nd.needsProjectedCommit) {
            commitCurrentProjectedSnapshot();
            nd.needsProjectedCommit = false;
          }
          const dragIds = new Set<string>([nd.id, ...Object.keys(nd.companionOrigins)]);
          if (nd.kind === 'hub') {
            for (const s of layout.satellites) {
              if (s.hubId === nd.id) dragIds.add(s.id);
            }
          }
          setActiveDraggingIds(dragIds);
        }
        suppressNextClickRef.current = true;
        const nextX = nd.originX + dx;
        const nextY = nd.originY + dy;
        nd.currX = nextX;
        nd.currY = nextY;

        if (nd.kind === 'hub') {
          const nextFollowers: Record<string, AITaskGraphPos> = {};
          for (const [fid, origin] of Object.entries(nd.companionOrigins)) {
            nextFollowers[fid] = { x: origin.x + dx, y: origin.y + dy };
          }
          moveHubWithFollowers(nd.id, { x: nextX, y: nextY }, nextFollowers);
        } else if (nd.isBatchGroupDrag) {
          const batchPos: Record<string, AITaskGraphPos> = {
            [nd.id]: { x: nextX, y: nextY },
          };
          for (const [cid, origin] of Object.entries(nd.companionOrigins)) {
            batchPos[cid] = { x: origin.x + dx, y: origin.y + dy };
          }
          moveTasksBatch(batchPos);
          const targetHub = findHubCardDropTarget(nextX, nextY, 28, 28);
          setDropTargetHubId(targetHub);
        } else {
          updateTaskPosition(nd.id, { x: nextX, y: nextY });
          const targetHub = findHubCardDropTarget(nextX, nextY, 26, 26);
          setDropTargetHubId(targetHub);
          if (!targetHub && nd.parentTaskId) {
            const parentSat = satById.get(nd.parentTaskId);
            if (
              parentSat &&
              Math.hypot(nextX - parentSat.x, nextY - parentSat.y) <= parentSat.radius + 24
            ) {
              setDropTargetParentId(parentSat.id);
            } else {
              setDropTargetParentId(null);
            }
          } else {
            setDropTargetParentId(null);
          }
        }
      }
    };

    const handleUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        activeTouchesRef.current.delete(e.pointerId);
        if (activeTouchesRef.current.size < 2) {
          pinchStateRef.current = null;
        }
      }

      if (marqueeRef.current) {
        marqueeRef.current = null;
        setMarquee(null);
        suppressNextClickRef.current = true;
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 40);
        return;
      }

      if (panDragRef.current) {
        if (!panDragRef.current.moved && !isSelectMode) {
          setSelectedTaskIds((prev) => (prev.size > 0 ? new Set() : prev));
        }
        panDragRef.current = null;
      }

      if (wireDrag) {
        if (wireDrag.hoverHubId) {
          if (wireDrag.sourceTaskIds.length > 1) {
            connectTasksBatchToHub(wireDrag.sourceTaskIds, wireDrag.hoverHubId);
          } else if (wireDrag.sourceTaskIds.length === 1) {
            connectTaskToHub(wireDrag.sourceTaskIds[0], wireDrag.hoverHubId);
          }
        }
        setWireDrag(null);
        setDropTargetHubId(null);
      }

      const nd = nodeDragRef.current;
      if (nd) {
        if (nd.kind === 'satellite' && nd.moved) {
          const targetHub = findHubCardDropTarget(nd.currX, nd.currY, 28, 28);
          if (targetHub) {
            if (nd.isBatchGroupDrag) {
              const allIds = [nd.id, ...Object.keys(nd.companionOrigins)];
              const movingSet = new Set(allIds);
              const parkedRecord: Record<string, AITaskGraphPos> = {};
              const parkedList: AITaskGraphPos[] = [];
              const dx = nd.currX - nd.originX;
              const dy = nd.currY - nd.originY;
              for (const tid of allIds) {
                const sat = satById.get(tid);
                const orig =
                  tid === nd.id ? { x: nd.originX, y: nd.originY } : nd.companionOrigins[tid];
                if (!sat || !orig) continue;
                const curX = orig.x + dx;
                const curY = orig.y + dy;
                const p = computeNonOverlappingHubParkPos(
                  targetHub,
                  curX,
                  curY,
                  orig.x,
                  orig.y,
                  sat.radius,
                  movingSet,
                  parkedList,
                );
                parkedRecord[tid] = p;
                parkedList.push(p);
              }
              connectTasksBatchToHub(allIds, targetHub, parkedRecord, true);
            } else {
              const parked = computeNonOverlappingHubParkPos(
                targetHub,
                nd.currX,
                nd.currY,
                nd.originX,
                nd.originY,
                nd.radius,
                new Set([nd.id]),
              );
              connectTaskToHub(nd.id, targetHub, parked, true);
            }
          } else if (!nd.isBatchGroupDrag && nd.parentTaskId) {
            const parentSat = satById.get(nd.parentTaskId);
            if (
              parentSat &&
              Math.hypot(nd.currX - parentSat.x, nd.currY - parentSat.y) <= parentSat.radius + 24
            ) {
              reattachChildToParent(nd.id, true);
            } else if (nd.wasAttachedChild) {
              // 未独立到其它配置星核的附属子节点，松手后自动回到母节点侧边空位簇，不散落在外
              clearTransientChildPosition(nd.id);
            }
          }
        }
        nodeDragRef.current = null;
        setActiveDraggingIds(new Set());
        setDropTargetHubId(null);
        setDropTargetParentId(null);
        window.setTimeout(() => {
          suppressNextClickRef.current = false;
        }, 40);
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [
    camera.x,
    camera.y,
    camera.zoom,
    clientToWorld,
    clearTransientChildPosition,
    commitCurrentProjectedSnapshot,
    computeNonOverlappingHubParkPos,
    connectTaskToHub,
    connectTasksBatchToHub,
    findHubCardDropTarget,
    isSelectMode,
    layout.satellites,
    localToWorld,
    moveHubWithFollowers,
    moveTasksBatch,
    reattachChildToParent,
    recordUndoCheckpoint,
    satById,
    updateTaskPosition,
    wireDrag,
  ]);

  // 原生非被动 wheel 监听：在画布内滚轮缩放时彻底阻断外层页面跟随上下滚动
  const hasDraftGraph = Boolean(draftGraph);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el || !hasDraftGraph) return;
    const onWheel = (e: WheelEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.('[data-radix-popper-content-wrapper]')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (Math.abs(e.deltaY) < 0.5 && Math.abs(e.deltaX) < 0.5) return;
      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      setCamera((prev) => {
        const clampedDelta = Math.max(-120, Math.min(120, e.deltaY));
        const factor = Math.exp(-clampedDelta * 0.0014);
        const nextZoom = Math.min(1.85, Math.max(0.36, prev.zoom * factor));
        const worldX = (cursorX - prev.x) / prev.zoom;
        const worldY = (cursorY - prev.y) / prev.zoom;
        return {
          x: cursorX - worldX * nextZoom,
          y: cursorY - worldY * nextZoom,
          zoom: Number(nextZoom.toFixed(3)),
        };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [hasDraftGraph, isLoading]);

  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size >= 2) {
        return;
      }
    }
    if (e.button !== 0) return;
    setOpenHubPopoverId(null);
    setOpenSatPopoverId(null);

    if (hasSelectionModifier(e) || isSelectMode) {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const startLocalX = e.clientX - rect.left;
      const startLocalY = e.clientY - rect.top;
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (!additive) {
        setSelectedTaskIds(new Set());
      }
      const nextMq: ActiveMarquee = {
        startLocalX,
        startLocalY,
        currLocalX: startLocalX,
        currLocalY: startLocalY,
        additive,
        baseSelection: additive ? new Set(selectedTaskIds) : new Set(),
      };
      marqueeRef.current = nextMq;
      setMarquee(nextMq);
      return;
    }

    panDragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      originCamX: camera.x,
      originCamY: camera.y,
      moved: false,
    };
  };

  const handlePointerDownHub = (e: React.PointerEvent<HTMLDivElement>, hubId: string) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size >= 2) return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    const hub = hubById.get(hubId);
    if (!hub) return;

    // 收集该配置星核下全部附属节点初始位置，拖动配置节点时整片星系联动跟随
    const companionOrigins: Record<string, AITaskGraphPos> = {};
    for (const sat of layout.satellites) {
      if (sat.hubId !== hubId) continue;
      if (sat.tier === 'core' || sat.isDetachedChild || draftGraph?.task_positions[sat.id]) {
        companionOrigins[sat.id] = { x: sat.x, y: sat.y };
      }
    }

    nodeDragRef.current = {
      kind: 'hub',
      id: hubId,
      parentTaskId: null,
      wasAttachedChild: false,
      radius: 0,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: hub.x,
      originY: hub.y,
      currX: hub.x,
      currY: hub.y,
      companionOrigins,
      isBatchGroupDrag: false,
      needsProjectedCommit: Boolean(layout.isOrientationProjected),
      moved: false,
    };
  };

  const handlePointerDownSatellite = (
    e: React.PointerEvent<HTMLDivElement>,
    satelliteId: string,
  ) => {
    if (e.pointerType === 'touch') {
      activeTouchesRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activeTouchesRef.current.size >= 2) return;
    }
    if (e.button !== 0) return;
    e.stopPropagation();
    if (hasSelectionModifier(e) || isSelectMode) {
      // 修饰键/多选模式下留给 onClick 做多选切换，不发起单节点拖拽
      return;
    }
    const sat = satById.get(satelliteId);
    if (!sat) return;
    setOpenHubPopoverId(null);
    if (openSatPopoverId && openSatPopoverId !== satelliteId) {
      setOpenSatPopoverId(null);
    }

    const isGroupDrag = selectedTaskIds.has(satelliteId) && selectedTaskIds.size > 1;
    const companionOrigins: Record<string, AITaskGraphPos> = {};
    if (isGroupDrag) {
      for (const sid of selectedTaskIds) {
        if (sid === satelliteId) continue;
        const peer = satById.get(sid);
        if (peer) {
          companionOrigins[sid] = { x: peer.x, y: peer.y };
        }
      }
    }

    nodeDragRef.current = {
      kind: 'satellite',
      id: satelliteId,
      parentTaskId: sat.parentTaskId,
      wasAttachedChild: sat.tier === 'child' && !sat.isDetachedChild,
      radius: sat.radius,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: sat.x,
      originY: sat.y,
      currX: sat.x,
      currY: sat.y,
      companionOrigins,
      isBatchGroupDrag: isGroupDrag,
      needsProjectedCommit: Boolean(layout.isOrientationProjected),
      moved: false,
    };
  };

  const handlePointerDownWireHandle = (
    e: React.PointerEvent<HTMLButtonElement>,
    sat: StarSatelliteItem,
  ) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    setOpenSatPopoverId(null);
    const sourceTaskIds =
      selectedTaskIds.has(sat.id) && selectedTaskIds.size > 1
        ? Array.from(selectedTaskIds)
        : [sat.kind.id];
    setWireDrag({
      sourceTaskIds,
      currX: sat.x,
      currY: sat.y,
      hoverHubId: null,
    });
  };

  const handleSelectSatellite = useCallback(
    (sat: StarSatelliteItem, e: React.MouseEvent | React.KeyboardEvent) => {
      if (suppressNextClickRef.current) return;
      setOpenHubPopoverId(null);

      if (hasSelectionModifier(e) || isSelectMode) {
        setOpenSatPopoverId(null);
        setSelectedTaskIds((prev) => {
          const next = new Set(prev);
          if (next.has(sat.id)) {
            next.delete(sat.id);
          } else {
            next.add(sat.id);
          }
          return next;
        });
        return;
      }

      const isAlreadyOpen = openSatPopoverId === sat.id;
      if (sat.childKinds.length > 0 && !sat.isExpandedParent) {
        toggleExpandParent(sat.id, true);
        setOpenSatPopoverId(sat.id);
        return;
      }
      setOpenSatPopoverId(isAlreadyOpen ? null : sat.id);
    },
    [isSelectMode, openSatPopoverId, toggleExpandParent],
  );

  const usedPrimarySet = useMemo(
    () => new Set((draftGraph?.nodes ?? []).map((n) => n.primary).filter(Boolean)),
    [draftGraph?.nodes],
  );

  // 实际高低档默认槽位由 chat / turn_router 连向的星核决定（与后端保存语义一致），
  // 而不是节点 role 标签；连线目标缺失时按 role 兜底，对齐后端 fallback
  const { highDefaultHubId, lowDefaultHubId } = useMemo(() => {
    if (!draftGraph) return { highDefaultHubId: '', lowDefaultHubId: '' };
    const nodeIds = new Set(draftGraph.nodes.map((n) => n.id));
    const roleHighId = draftGraph.nodes.find((n) => n.role === 'high')?.id ?? '';
    const roleLowId = draftGraph.nodes.find((n) => n.role === 'low')?.id ?? '';
    const chatTarget = draftGraph.edges.chat;
    const routerTarget = draftGraph.edges.turn_router;
    return {
      highDefaultHubId: chatTarget && nodeIds.has(chatTarget) ? chatTarget : roleHighId,
      lowDefaultHubId: routerTarget && nodeIds.has(routerTarget) ? routerTarget : roleLowId,
    };
  }, [draftGraph]);

  const handleRequestCreateForHub = (hubId: string) => {
    // 拖拽占位星核松手时 click 必然命中卡片本体，本条路径不走 popover 的 suppress 检查，需自行拦截
    if (suppressNextClickRef.current) return;
    markPendingBindHub(hubId);
    onOpenCreateConfig();
  };

  const handleRequestRemoveHub = (node: AITaskGraphHubNode, connectedCount: number) => {
    if (!draftGraph || draftGraph.nodes.length <= 1) return;
    if (connectedCount <= 0) {
      removeHubNode(node.id);
      return;
    }
    const candidate = draftGraph.nodes.find((n) => n.id !== node.id)?.id ?? '';
    setRemovingHubState({
      node,
      connectedCount,
      migrateTargetId: candidate,
    });
  };

  const hubLabel = (node: AITaskGraphHubNode): string => {
    if (!node.primary) {
      return node.role === 'high'
        ? t('aiConfig.starGraph.placeholderHigh')
        : node.role === 'low'
          ? t('aiConfig.starGraph.placeholderLow')
          : t('aiConfig.starGraph.placeholderCustom');
    }
    return configByName.get(node.primary)?.config_name ?? node.primary;
  };

  if (isLoading && !draftGraph) {
    return (
      <div className="glass-card rounded-2xl">
        <div className="flex h-80 items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (loadError && !draftGraph) {
    return (
      <GlassAlert tone="danger" icon={AlertTriangle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs sm:text-sm">
            {t('aiConfig.taskModels.loadFailed')}: {loadError}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => void reload()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {t('aiConfig.taskModels.retry')}
          </Button>
        </div>
      </GlassAlert>
    );
  }

  if (!draftGraph) return null;

  const draggingSatList = Array.from(activeDraggingIds)
    .map((id) => satById.get(id))
    .filter((s): s is StarSatelliteItem => Boolean(s));
  const draggingHoverHub =
    dropTargetHubId && nodeDragRef.current?.kind === 'satellite'
      ? hubById.get(dropTargetHubId)
      : undefined;

  const marqueeRect = marquee
    ? {
        left: Math.min(marquee.startLocalX, marquee.currLocalX),
        top: Math.min(marquee.startLocalY, marquee.currLocalY),
        width: Math.abs(marquee.currLocalX - marquee.startLocalX),
        height: Math.abs(marquee.currLocalY - marquee.startLocalY),
      }
    : null;

  const graphBody = (
    <div
      className={cn(
        'glass-card rounded-2xl',
        isFullscreen && 'fixed inset-2 sm:inset-4 z-50 flex flex-col shadow-2xl',
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[inherit]">
        {/* 顶栏操作区（兼容桌面横向与移动端两列折行） */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <Popover open={addHubPopoverOpen} onOpenChange={setAddHubPopoverOpen}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{t('aiConfig.starGraph.addConfigHub')}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-72 p-2.5 space-y-2 glass-card"
                align="start"
                sideOffset={6}
                onWheel={(e) => e.stopPropagation()}
              >
                <div className="max-h-52 overflow-y-auto space-y-1">
                  {allConfigsList.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      {t('aiConfig.taskConfig.emptyHint')}
                    </p>
                  ) : (
                    allConfigsList.map((cfg) => {
                      const inGraph = usedPrimarySet.has(cfg.name);
                      return (
                        <button
                          key={cfg.name}
                          type="button"
                          disabled={inGraph}
                          onClick={() => {
                            addHubNode(cfg.name);
                            setAddHubPopoverOpen(false);
                            window.setTimeout(fitCameraToBounds, 30);
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors',
                            inGraph
                              ? 'cursor-not-allowed opacity-55'
                              : 'hover:bg-muted/60 cursor-pointer',
                          )}
                        >
                          <ModelBrandIcon
                            modelName={cfg.model_name}
                            provider={cfg.provider}
                            size={16}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{cfg.config_name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {cfg.model_name}
                            </p>
                          </div>
                          {inGraph && (
                            <Badge variant="outline" className="h-4 px-1 text-[10px] shrink-0">
                              {t('aiConfig.starGraph.alreadyInGraph')}
                            </Badge>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
                <div className="border-t border-border/40 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 w-full gap-1.5 text-xs"
                    onClick={() => {
                      setAddHubPopoverOpen(false);
                      const newId = addHubNode('');
                      markPendingBindHub(newId);
                      onOpenCreateConfig();
                    }}
                  >
                    <Plus className="h-3.5 w-3.5 shrink-0" />
                    {t('aiConfig.openaiConfig.createNew')}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant={isSelectMode ? 'default' : 'outline'}
              size="sm"
              className="h-9 gap-1.5 text-xs"
              title={t('aiConfig.starGraph.boxSelectHint')}
              onClick={() => setIsSelectMode((v) => !v)}
            >
              <SquareDashedMousePointer className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.boxSelectBtn')}</span>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
            <TabButtonGroup
              size="sm"
              singleRowOnMobile
              value={usageMetric}
              onValueChange={(v) => setUsageMetric(v as StarUsageMetric)}
              options={[
                { value: 'tokens', label: t('aiConfig.starGraph.metricTokens') },
                { value: 'requests', label: t('aiConfig.starGraph.metricRequests') },
              ]}
            />

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canUndo}
              title={t('aiConfig.starGraph.undoShortcutHint')}
              className="h-8 gap-1 text-xs"
              onClick={() => undo()}
            >
              <Undo2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.undoStep')}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isGraphDirty}
              className="h-8 gap-1 text-xs"
              title={t('aiConfig.starGraph.discardDraft')}
              onClick={() => discardDraftChanges()}
            >
              <Eraser className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.discardDraft')}</span>
            </Button>

            {hasExpandableParents && (
              <Button
                type="button"
                variant={showAllChildren ? 'default' : 'outline'}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                title={
                  showAllChildren
                    ? t('aiConfig.starGraph.collapseLowFreq')
                    : t('aiConfig.starGraph.expandAllTasks')
                }
                onClick={() => {
                  setShowAllChildren((v) => !v);
                  window.setTimeout(fitCameraToBounds, 40);
                }}
              >
                {showAllChildren ? (
                  <ListCollapse className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ListTree className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {showAllChildren
                    ? t('aiConfig.starGraph.collapseLowFreq')
                    : t('aiConfig.starGraph.expandAllTasks')}
                </span>
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              title={t('aiConfig.starGraph.autoLayout')}
              onClick={() => {
                rearrangeLayout(isNarrow);
                window.setTimeout(fitCameraToBounds, 40);
              }}
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.rearrangeLayout')}</span>
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title={t('aiConfig.starGraph.resetDefaultTopology')}
              onClick={() => setConfirmResetOpen(true)}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              title={
                isFullscreen
                  ? t('aiConfig.starGraph.exitFullscreen')
                  : t('aiConfig.starGraph.fullscreen')
              }
              onClick={() => {
                setIsFullscreen((v) => !v);
                window.setTimeout(fitCameraToBounds, 60);
              }}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* 旧版 Core 不支持图谱保存的降级提示（P-17：识别缺失字段后 UI 降级而非保存时才报错） */}
        {isGraphUnsupported && (
          <div className="flex items-center gap-1.5 border-b border-border/30 bg-amber-500/10 px-3 sm:px-4 py-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0">{t('aiConfig.starGraph.unsupportedBackendHint')}</span>
          </div>
        )}

        {/* 未配置 '+' 星核提示条 / 未保存提示条 */}
        {(unconfiguredHubIds.length > 0 || isGraphDirty) && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/30 bg-muted/25 px-3 sm:px-4 py-1.5 text-xs">
            {unconfiguredHubIds.length > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t('aiConfig.starGraph.unconfiguredHubBlocked')}</span>
              </span>
            ) : (
              <span className="text-primary font-medium truncate">
                {t('aiConfig.starGraph.unsavedDraftHint')}
              </span>
            )}
          </div>
        )}

        {/* 星型交互画布视口 */}
        <div
          ref={viewportRef}
          onPointerDown={handlePointerDownCanvas}
          style={{
            backgroundImage:
              'radial-gradient(hsl(var(--muted-foreground) / 0.18) 1px, transparent 1px)',
            backgroundSize: `${Math.max(12, Math.round(22 * camera.zoom))}px ${Math.max(12, Math.round(22 * camera.zoom))}px`,
            backgroundPosition: `${Math.round(camera.x)}px ${Math.round(camera.y)}px`,
          }}
          className={cn(
            'relative w-full select-none overflow-hidden overscroll-contain touch-none',
            isSelectMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing',
            isFullscreen ? 'flex-1 min-h-0' : 'h-[580px] sm:h-[600px]',
          )}
        >
          {/* 批量选中快捷连接悬浮条 */}
          {selectedTaskIds.size > 0 && (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="absolute left-3 right-3 top-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 sm:max-w-[92%] z-30 flex flex-wrap items-center gap-1.5 rounded-xl border border-primary/45 bg-background/90 px-3 py-2 shadow-lg backdrop-blur-md"
            >
              <Badge className="h-5 px-1.5 text-[11px] shrink-0">
                {t('aiConfig.starGraph.batchSelectedCount', { count: selectedTaskIds.size })}
              </Badge>
              <span className="text-xs text-muted-foreground shrink-0">
                {t('aiConfig.starGraph.batchConnectTo')}
              </span>
              <div className="flex flex-wrap items-center gap-1 min-w-0">
                {draftGraph.nodes.map((hub) => {
                  const cfg = hub.primary ? configByName.get(hub.primary) : undefined;
                  return (
                    <button
                      key={hub.id}
                      type="button"
                      onClick={() => {
                        connectTasksBatchToHub(Array.from(selectedTaskIds), hub.id);
                        setSelectedTaskIds(new Set());
                        setIsSelectMode(false);
                      }}
                      className="inline-flex max-w-[150px] items-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10"
                    >
                      {cfg ? (
                        <ModelBrandIcon
                          modelName={cfg.model_name}
                          provider={cfg.provider}
                          size={14}
                        />
                      ) : (
                        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-dashed border-primary/60 text-[10px] text-primary">
                          +
                        </span>
                      )}
                      <span className="truncate">{hubLabel(hub)}</span>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                title={t('common.cancel')}
                onClick={() => {
                  setSelectedTaskIds(new Set());
                  setIsSelectMode(false);
                }}
                className="ml-auto inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* SVG 连线层 */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <g transform={`translate(${camera.x}, ${camera.y}) scale(${camera.zoom})`}>
              {/* 拖拽节点或拉线接近配置星核时的感应光晕 */}
              {(wireDrag || draggingHoverHub || nodeDragRef.current?.kind === 'satellite') &&
                layout.hubs.map((hub) => {
                  const isTarget = dropTargetHubId === hub.node.id;
                  return (
                    <rect
                      key={`drop-halo-${hub.node.id}`}
                      x={hub.x - HUB_CARD_HALF_W - 18}
                      y={hub.y - HUB_CARD_HALF_H - 18}
                      width={(HUB_CARD_HALF_W + 18) * 2}
                      height={(HUB_CARD_HALF_H + 18) * 2}
                      rx={24}
                      fill={isTarget ? 'hsl(var(--primary) / 0.08)' : 'none'}
                      stroke={isTarget ? 'hsl(var(--primary) / 0.65)' : 'hsl(var(--border) / 0.35)'}
                      strokeWidth={isTarget ? 2 : 1}
                      strokeDasharray="6 5"
                    />
                  );
                })}

              {/* 1) 一级核心任务 & 已独立改绑子节点 ──▶ 中心配置星核 */}
              {layout.satellites.map((sat) => {
                if (sat.visualParentTaskId) return null;
                const hub = hubById.get(sat.hubId);
                if (!hub) return null;
                const angle = Math.atan2(hub.y - sat.y, hub.x - sat.x);
                const sx = sat.x + Math.cos(angle) * sat.radius;
                const sy = sat.y + Math.sin(angle) * sat.radius;
                const targetPt = rectBoundaryPoint(
                  hub.x,
                  hub.y,
                  HUB_CARD_HALF_W,
                  HUB_CARD_HALF_H,
                  sat.x,
                  sat.y,
                );
                const isMainChat = sat.kind.id === 'chat';
                const isAutonomy = sat.kind.id === 'autonomy';
                const isPlaceholderHub = !hub.node.primary;
                const isFocus =
                  hoveredHubId === hub.node.id ||
                  openHubPopoverId === hub.node.id ||
                  openSatPopoverId === sat.id ||
                  selectedTaskIds.has(sat.id);
                const isDim =
                  Boolean(hoveredHubId && hoveredHubId !== hub.node.id) ||
                  Boolean(wireDrag && !wireDrag.sourceTaskIds.includes(sat.id));

                const strokeColor = isMainChat
                  ? 'hsl(var(--primary))'
                  : isAutonomy
                    ? '#f59e0b'
                    : sat.isDetachedChild
                      ? 'hsl(199 89% 48% / 0.78)'
                      : isFocus
                        ? 'hsl(var(--primary) / 0.85)'
                        : 'hsl(var(--muted-foreground) / 0.4)';

                return (
                  <path
                    key={`edge-hub-${sat.id}-${hub.node.id}`}
                    d={buildCurvedRayPath(sx, sy, targetPt.x, targetPt.y)}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isMainChat || isAutonomy ? 2.4 : isFocus ? 2 : 1.5}
                    strokeDasharray={isPlaceholderHub ? '5 5' : undefined}
                    opacity={isDim ? 0.2 : 1}
                  />
                );
              })}

              {/* 2) 二级跟随子节点 ──▶ 所属一级母节点 */}
              {layout.satellites.map((sat) => {
                if (!sat.visualParentTaskId) return null;
                const parentSat = satById.get(sat.visualParentTaskId);
                if (!parentSat) return null;
                const angle = Math.atan2(parentSat.y - sat.y, parentSat.x - sat.x);
                const sx = sat.x + Math.cos(angle) * sat.radius;
                const sy = sat.y + Math.sin(angle) * sat.radius;
                const px = parentSat.x - Math.cos(angle) * parentSat.radius;
                const py = parentSat.y - Math.sin(angle) * parentSat.radius;
                const isFocus =
                  openSatPopoverId === sat.id ||
                  openSatPopoverId === parentSat.id ||
                  hoveredHubId === sat.hubId ||
                  selectedTaskIds.has(sat.id);
                const isDim = Boolean(hoveredHubId && hoveredHubId !== sat.hubId);

                return (
                  <path
                    key={`edge-parent-${sat.id}-${parentSat.id}`}
                    d={buildCurvedRayPath(sx, sy, px, py, 0.05)}
                    fill="none"
                    stroke={
                      isFocus ? 'hsl(var(--primary) / 0.75)' : 'hsl(var(--muted-foreground) / 0.42)'
                    }
                    strokeWidth={isFocus ? 1.8 : 1.35}
                    strokeDasharray="4 4"
                    opacity={isDim ? 0.2 : 1}
                  />
                );
              })}

              {/* 单选/多选拉线或节点拖向配置星核时的实时批量预览连线 */}
              {wireDrag?.sourceTaskIds.map((srcId) => {
                const srcSat = satById.get(srcId);
                if (!srcSat) return null;
                return (
                  <path
                    key={`wire-preview-${srcId}`}
                    d={buildCurvedRayPath(srcSat.x, srcSat.y, wireDrag.currX, wireDrag.currY)}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.4}
                    strokeDasharray="6 4"
                  />
                );
              })}
              {draggingHoverHub &&
                draggingSatList.map((srcSat) => (
                  <path
                    key={`drop-preview-${srcSat.id}`}
                    d={buildCurvedRayPath(
                      srcSat.x,
                      srcSat.y,
                      draggingHoverHub.x,
                      draggingHoverHub.y,
                    )}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.3}
                    strokeDasharray="6 4"
                  />
                ))}
            </g>
          </svg>

          {/* HTML 节点层 */}
          <div
            style={{
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.zoom})`,
              transformOrigin: '0 0',
            }}
            className="absolute left-0 top-0 h-0 w-0"
          >
            {layout.hubs.map((hub) => (
              <div
                key={hub.node.id}
                onMouseEnter={() => setHoveredHubId(hub.node.id)}
                onMouseLeave={() => setHoveredHubId(null)}
              >
                <StarHubCard
                  t={t}
                  item={hub}
                  allConfigsList={allConfigsList}
                  configByName={configByName}
                  metric={usageMetric}
                  isHighDefault={hub.node.id === highDefaultHubId}
                  isLowDefault={hub.node.id === lowDefaultHubId}
                  isHighlighted={hoveredHubId === hub.node.id || openHubPopoverId === hub.node.id}
                  isDropTarget={dropTargetHubId === hub.node.id}
                  isUnconfiguredBlocked={unconfiguredHubIds.includes(hub.node.id)}
                  isDragging={activeDraggingIds.has(hub.node.id)}
                  canRemove={draftGraph.nodes.length > 1}
                  popoverOpen={openHubPopoverId === hub.node.id}
                  onPopoverOpenChange={(next) => {
                    if (suppressNextClickRef.current) return;
                    setOpenHubPopoverId(next ? hub.node.id : null);
                    if (next) setOpenSatPopoverId(null);
                  }}
                  onPointerDownHub={handlePointerDownHub}
                  onSelectPrimary={assignHubPrimary}
                  onSelectSecondary={assignHubSecondary}
                  onRequestCreateForHub={handleRequestCreateForHub}
                  onOpenEditConfig={onOpenEditConfig}
                  onRequestRemoveHub={handleRequestRemoveHub}
                />
              </div>
            ))}

            {layout.satellites.map((sat) => {
              const hub = hubById.get(sat.hubId);
              if (!hub) return null;
              const visualParent = sat.visualParentTaskId
                ? satById.get(sat.visualParentTaskId)
                : undefined;
              const logicalParent = sat.parentTaskId ? satById.get(sat.parentTaskId) : undefined;
              const anchorX = visualParent ? visualParent.x : hub.x;
              const anchorY = visualParent ? visualParent.y : hub.y;

              return (
                <StarSatelliteBubble
                  key={sat.id}
                  t={t}
                  tr={tr}
                  satellite={sat}
                  anchorX={anchorX}
                  anchorY={anchorY}
                  parentTitle={logicalParent ? resolveKindTitle(logicalParent.kind, tr) : undefined}
                  preferredPopoverSide={pickNonOverlappingPopoverSide(sat, hub.x, hub.y)}
                  hubNodes={draftGraph.nodes}
                  configByName={configByName}
                  metric={usageMetric}
                  isHighlighted={openSatPopoverId === sat.id}
                  isBatchSelected={selectedTaskIds.has(sat.id)}
                  isParentDropTarget={dropTargetParentId === sat.id}
                  isDimmed={Boolean(hoveredHubId && hoveredHubId !== sat.hubId)}
                  isDragging={activeDraggingIds.has(sat.id)}
                  popoverOpen={openSatPopoverId === sat.id}
                  onSelectSatellite={handleSelectSatellite}
                  onToggleExpandParent={toggleExpandParent}
                  onPopoverOpenChange={(next) => {
                    if (suppressNextClickRef.current) return;
                    setOpenSatPopoverId(next ? sat.id : null);
                    if (next) setOpenHubPopoverId(null);
                  }}
                  onPointerDownSatellite={handlePointerDownSatellite}
                  onPointerDownWireHandle={handlePointerDownWireHandle}
                  onConnectToHub={connectTaskToHub}
                  onReattachToParent={reattachChildToParent}
                />
              );
            })}
          </div>

          {/* Alt / Shift / Ctrl 框选矩形遮罩 */}
          {marqueeRect && (
            <div
              style={{
                left: marqueeRect.left,
                top: marqueeRect.top,
                width: marqueeRect.width,
                height: marqueeRect.height,
              }}
              className="pointer-events-none absolute z-40 rounded-md border border-primary bg-primary/12"
            />
          )}

          {/* 左下角图例（移动端紧凑宽度避免碰撞右下缩放栏） */}
          <div className="pointer-events-none absolute bottom-3 left-3 max-w-[calc(100%-156px)] flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/75 px-2.5 sm:px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur-md">
            <span className="inline-flex items-center gap-1 text-primary font-medium truncate">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.legendMainChat')}</span>
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium truncate">
              <Compass className="h-3 w-3 shrink-0" />
              <span className="truncate">{t('aiConfig.starGraph.legendAutonomy')}</span>
            </span>
            <span className="hidden md:inline truncate opacity-80">
              · {t('aiConfig.starGraph.legendSizeHint')}
            </span>
          </div>

          {/* 右下角缩放胶囊 */}
          <div
            className="absolute bottom-3 right-3 flex items-center gap-0.5 rounded-xl border border-border/50 bg-background/80 p-1 backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setCamera((c) => ({
                  ...c,
                  zoom: Math.max(0.36, Number((c.zoom - 0.12).toFixed(2))),
                }))
              }
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <button
              type="button"
              onClick={fitCameraToBounds}
              className="min-w-[42px] px-1 text-center text-[11px] tabular-nums text-muted-foreground hover:text-foreground"
            >
              {Math.round(camera.zoom * 100)}%
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() =>
                setCamera((c) => ({
                  ...c,
                  zoom: Math.min(1.85, Number((c.zoom + 0.12).toFixed(2))),
                }))
              }
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title={t('aiConfig.starGraph.fitView')}
              onClick={fitCameraToBounds}
            >
              <Expand className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {graphBody}

      {/* 移除仍挂有任务的星核：迁移目标选择 Dialog */}
      <Dialog
        open={removingHubState !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingHubState(null);
        }}
      >
        <DialogContent className="sm:max-w-[440px] glass-card">
          <DialogHeader>
            <DialogTitle>{t('aiConfig.starGraph.removeHubTitle')}</DialogTitle>
            <DialogDescription>
              {t('aiConfig.starGraph.removeHubDesc', {
                name: removingHubState ? hubLabel(removingHubState.node) : '',
                count: removingHubState?.connectedCount ?? 0,
              })}
            </DialogDescription>
          </DialogHeader>
          {removingHubState && (
            <div className="space-y-2 py-1">
              <p className="text-xs font-medium text-muted-foreground">
                {t('aiConfig.starGraph.migrateTargetLabel')}
              </p>
              <Select
                value={removingHubState.migrateTargetId}
                onValueChange={(val) =>
                  setRemovingHubState((prev) => (prev ? { ...prev, migrateTargetId: val } : null))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {draftGraph.nodes
                    .filter((n) => n.id !== removingHubState.node.id)
                    .map((n) => (
                      <SelectItem key={n.id} value={n.id}>
                        {hubLabel(n)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingHubState(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removingHubState) {
                  removeHubNode(removingHubState.node.id, removingHubState.migrateTargetId);
                  setRemovingHubState(null);
                  window.setTimeout(fitCameraToBounds, 30);
                }
              }}
            >
              {t('aiConfig.starGraph.confirmMigrateAndRemove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复默认双星核连线确认 */}
      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiConfig.starGraph.resetDefaultTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiConfig.starGraph.resetDefaultDesc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmResetOpen(false);
                resetToDefaultTwoHubs();
                window.setTimeout(fitCameraToBounds, 30);
              }}
            >
              {t('aiConfig.starGraph.resetDefaultTopology')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
