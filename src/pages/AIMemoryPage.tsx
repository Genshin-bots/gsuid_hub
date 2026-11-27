import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { GlassAlert } from '@/components/ui/glass-alert';
import { Skeleton } from '@/components/ui/skeleton';
import { tabToolbarControlClass } from '@/components/ui/TabButtonGroup';
import {
  headerActionRowClass,
  pageGapClass,
  pageStackClass,
  PinnedPage,
} from '@/components/layout/PinnedPage';
import { MetricHero, RatioBar, type RatioSlice } from '@/components/ui/DataBlock';
import MemorySearchPanel from '@/components/memory/MemorySearchPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { InputWithDropdown } from '@/components/ui/input-with-dropdown';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Database,
  Brain,
  MessageSquare,
  GitBranch,
  Network,
  Search,
  Trash2,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronRight,
  Layers,
  Users,
  User,
  Eye,
  Clock,
  Zap,
  Globe,
  BookOpen,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ListChecks,
  Pencil,
  Save,
  Power,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  api,
  agentDebugApi,
  cognitionApi,
  getAuthToken,
  memoryApi,
  resolveApiAssetUrl,
  type AgentDebugMemoryConflict,
  type AgentDebugMemoryEdge,
  type CognitionAttachment,
  type CognitionNode,
  type MemoryStats,
  type MemoryScope,
  type MemoryEpisode as Episode,
  type MemoryEntity as Entity,
  type MemoryEdge as Edge,
  type MemoryThread,
  type MemoryThreadDetail as ThreadDetail,
  type MemoryConfig,
  type MemoryMigrationReport as MigrationV21Report,
  type MemoryHierGraphStatus as HierGraphStatus,
  type MemoryPreference as Preference,
  type MemoryEntityDetail as EntityDetailData,
} from '@/lib/api';
import { CognitionArticlePreview } from '@/components/cognition/CognitionArticlePreview';
import { CognitionAttachments } from '@/components/cognition/CognitionAttachments';
import { WorldHubGraph } from '@/components/cognition/WorldHubGraph';
import {
  hubForEntity,
  isCognitionBackendMissing,
  isWorldHub,
  mergeCognitionNodes,
  pluginFromWorldRef,
  worldGraphId,
} from '@/lib/cognition';
import MemorySettingsDialog from '@/components/memory/MemorySettingsDialog';
import { EntityCurationDrawer } from '@/components/memory/EntityCurationDrawer';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';

// ============================================================================
// Utility
// ============================================================================

function formatScopeType(scopeKey: string): { type: string; id: string } {
  if (scopeKey.startsWith('group:')) return { type: 'group', id: scopeKey.replace('group:', '') };
  if (scopeKey.startsWith('user_global:'))
    return { type: 'user_global', id: scopeKey.replace('user_global:', '') };
  if (scopeKey.startsWith('user_in_group:')) {
    const parts = scopeKey.replace('user_in_group:', '').split('@');
    return { type: 'user_in_group', id: parts[0] };
  }
  if (scopeKey.startsWith('self:')) return { type: 'self', id: scopeKey.replace('self:', '') };
  return { type: 'unknown', id: scopeKey };
}

function resolveMemoryAssetUrl(rawUrl: string): string {
  const raw = rawUrl.trim();
  if (!raw) return '';
  const resolved = resolveApiAssetUrl(raw);
  if (!raw.startsWith('/api/')) return resolved;
  const token = getAuthToken();
  if (!token || resolved.includes('token=')) return resolved;
  return `${resolved}${resolved.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
}

function isValidScopeAvatarUrl(rawUrl: string | undefined): rawUrl is string {
  const raw = (rawUrl || '').trim();
  return /^https?:\/\//i.test(raw) || raw.startsWith('/api/') || raw.startsWith('data:image/');
}

function scopeAvatarUrl(scope: MemoryScope, type: string, id: string): string {
  const direct = (scope.avatar_url || '').trim();
  if (isValidScopeAvatarUrl(direct)) return resolveMemoryAssetUrl(direct);
  if (/^\d{5,12}$/.test(id)) {
    if (type === 'group') return `https://p.qlogo.cn/gh/${id}/${id}/100`;
    if (type === 'user_global' || type === 'user_in_group') {
      return `https://q1.qlogo.cn/g?b=qq&nk=${id}&s=100`;
    }
  }
  const speaker = (scope.speaker_previews ?? []).find((item) =>
    isValidScopeAvatarUrl(item.avatar_url),
  );
  return speaker ? resolveMemoryAssetUrl(speaker.avatar_url) : '';
}

function ScopeAvatar({
  scope,
  type,
  id,
  name,
}: {
  scope: MemoryScope;
  type: string;
  id: string;
  name: string;
}) {
  const url = scopeAvatarUrl(scope, type, id);
  const FallbackIcon = type === 'group' ? Users : type === 'self' ? Brain : User;
  return (
    <Avatar className="h-10 w-10 border border-primary/25 bg-primary/10 shadow-sm">
      {url && (
        <AvatarImage
          src={url}
          alt={name}
          referrerPolicy="no-referrer"
          className="object-cover"
          loading="lazy"
        />
      )}
      <AvatarFallback className="bg-primary/10 text-primary">
        <FallbackIcon className="h-5 w-5" />
      </AvatarFallback>
    </Avatar>
  );
}

function ScopeSpeakerPreviews({ scope }: { scope: MemoryScope }) {
  const speakers = (scope.speaker_previews ?? [])
    .filter((speaker) => isValidScopeAvatarUrl(speaker.avatar_url))
    .slice(0, 3);
  if (speakers.length === 0) return null;
  return (
    <div className="mt-1 flex items-center -space-x-1.5">
      {speakers.map((speaker) => (
        <Avatar
          key={speaker.user_id}
          title={`${speaker.name} (${speaker.user_id})`}
          className="h-4 w-4 border border-background bg-primary/10"
        >
          <AvatarImage
            src={resolveMemoryAssetUrl(speaker.avatar_url)}
            alt={speaker.name}
            referrerPolicy="no-referrer"
            className="object-cover"
            loading="lazy"
          />
          <AvatarFallback className="bg-primary/15 text-[8px] text-primary">
            {speaker.name.slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      ))}
    </div>
  );
}

function sanitizeScopes(rawScopes: MemoryScope[] | null | undefined): MemoryScope[] {
  if (!rawScopes || rawScopes.length === 0) return [];
  const knownGroupIds = new Set(
    rawScopes
      .filter((s) => s.scope_key.startsWith('group:'))
      .map((s) => s.scope_key.slice('group:'.length)),
  );
  return rawScopes.filter((s) => {
    if (!s.scope_key.startsWith('user_global:')) return true;
    const id = s.scope_key.slice('user_global:'.length);
    return (
      !id.startsWith('__assistant_') &&
      !id.startsWith('self:') &&
      !id.startsWith('group:') &&
      !knownGroupIds.has(id)
    );
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

// ============================================================================
// Knowledge Graph Visualization (WebGL via sigma.js + graphology)
// ============================================================================

const CENTER_NODE_COUNT = 3;
const HUGE_GRAPH_NODE_THRESHOLD = 5000;
const FA2_MAX_NODES = 8000; // above this the force layout is skipped (deterministic layout only)
const MAX_RENDER_EDGES = 30000; // hard cap so layout + rendering stay bounded
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type NodeKind = 'speaker' | 'entity' | 'placeholder';

interface NodeMeta {
  id: string;
  label: string;
  degree: number;
  kind: NodeKind;
  centerRank?: number;
  avatarUrl?: string;
  aliases?: string[];
}

// Even, overlap-free disk layout used as the starting point — and as the final
// layout for graphs too large to run a force simulation on.
function phyllotaxisPosition(index: number, spacing: number): { x: number; y: number } {
  const radius = spacing * Math.sqrt(index + 0.5);
  const angle = index * GOLDEN_ANGLE;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function getGraphPalette(isDark: boolean) {
  return isDark
    ? {
        speaker: '#60a5fa',
        entity: '#818cf8',
        placeholder: '#94a3b8',
        center: '#facc15',
        edge: 'rgba(96,165,250,0.7)',
        edgeInvalid: 'rgba(248,113,113,0.75)',
        nodeDim: 'rgba(100,116,139,0.18)',
        edgeDim: 'rgba(96,165,250,0.12)',
        label: '#e2e8f0',
        labelBg: 'rgba(15,23,42,0.78)',
      }
    : {
        speaker: '#3b82f6',
        entity: '#6366f1',
        placeholder: '#64748b',
        center: '#f59e0b',
        edge: 'rgba(37,99,235,0.6)',
        edgeInvalid: 'rgba(239,68,68,0.65)',
        nodeDim: 'rgba(148,163,184,0.22)',
        edgeDim: 'rgba(37,99,235,0.12)',
        label: '#1e293b',
        labelBg: 'rgba(255,255,255,0.82)',
      };
}

function KnowledgeGraph({
  entities,
  edges,
  isGlass,
  isDark,
  onNodeClick,
  selectedScope,
  onScopeChange,
  scopes,
  onClearMemory,
  onRefresh,
}: {
  entities: Entity[];
  edges: Edge[];
  isGlass: boolean;
  isDark: boolean;
  onNodeClick: (type: 'entity', id: string) => void;
  selectedScope?: string;
  onScopeChange?: (scope: string) => void;
  scopes?: MemoryScope[];
  onClearMemory?: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const avatarCanvasRef = useRef<HTMLCanvasElement>(null);
  const avatarImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fa2Ref = useRef<FA2Layout | null>(null);

  // Mutable refs read by sigma's reducers, so theme/hover/focus changes only need a refresh.
  const isDarkRef = useRef(isDark);
  const hoveredRef = useRef<string | null>(null);
  const highlightRef = useRef<Set<string> | null>(null);
  const focusedRef = useRef<string | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  isDarkRef.current = isDark;
  onNodeClickRef.current = onNodeClick;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [showIsolatedItems, setShowIsolatedItems] = useState(false);

  // 默认展示所有说话人节点 + 有关系的节点；仅在开启「显示孤立事物节点」时显示度为 0 的非人节点。
  const nodeMeta = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      if (edge.source_entity_id === edge.target_entity_id) continue;
      degree.set(edge.source_entity_id, (degree.get(edge.source_entity_id) || 0) + 1);
      degree.set(edge.target_entity_id, (degree.get(edge.target_entity_id) || 0) + 1);
    }
    const meta = new Map<string, NodeMeta>();
    for (const entity of entities) {
      const deg = degree.get(entity.id) || 0;
      if (!entity.is_speaker && deg === 0 && !showIsolatedItems) continue;
      const rawAv = (entity.avatar_url || '').trim();
      const avatarUrl = /^https?:\/\//i.test(rawAv) ? rawAv : undefined;
      meta.set(entity.id, {
        id: entity.id,
        label: entity.name,
        degree: deg,
        kind: entity.is_speaker ? 'speaker' : 'entity',
        avatarUrl,
        aliases: entity.aliases ?? [],
      });
    }
    for (const edge of edges) {
      if (edge.source_entity_id === edge.target_entity_id) continue;
      for (const id of [edge.source_entity_id, edge.target_entity_id]) {
        if (!meta.has(id)) {
          meta.set(id, {
            id,
            label: id.slice(0, 8),
            degree: degree.get(id) || 0,
            kind: 'placeholder',
          });
        }
      }
    }
    Array.from(meta.values())
      .filter((m) => m.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, CENTER_NODE_COUNT)
      .forEach((m, i) => {
        m.centerRank = i + 1;
      });
    return meta;
  }, [entities, edges, showIsolatedItems]);

  const visibleEntityCount = useMemo(
    () => Array.from(nodeMeta.values()).filter((m) => m.kind !== 'placeholder').length,
    [nodeMeta],
  );

  const nodeSearchResults = useMemo(() => {
    const query = nodeSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return Array.from(nodeMeta.values())
      .filter(
        (m) =>
          m.label.toLowerCase().includes(query) ||
          m.id.toLowerCase().includes(query) ||
          (m.aliases ?? []).some((al) => al.toLowerCase().includes(query)),
      )
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8);
  }, [nodeMeta, nodeSearchQuery]);

  // Build the graphology graph + sigma renderer + circular QQ avatar canvas overlay.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let active = true;
    const graph = new Graph({ multi: true, type: 'directed' });
    const spacing = nodeMeta.size > HUGE_GRAPH_NODE_THRESHOLD ? 12 : 24;
    const avatarNodes: Array<{ id: string; url: string; centerRank: number }> = [];

    let index = 0;
    nodeMeta.forEach((m) => {
      const pos = phyllotaxisPosition(index++, spacing);
      const hasAvatar = m.kind === 'speaker' && Boolean(m.avatarUrl);
      const size = m.centerRank
        ? 14 - m.centerRank
        : m.kind === 'speaker'
          ? 8.5
          : m.kind === 'placeholder'
            ? 3.5
            : 5;
      graph.addNode(m.id, {
        x: pos.x,
        y: pos.y,
        size,
        label: truncateText(m.label, 24),
        kind: m.kind,
        centerRank: m.centerRank ?? 0,
        degree: m.degree,
        hasAvatar,
      });
      if (hasAvatar && m.avatarUrl) {
        avatarNodes.push({ id: m.id, url: m.avatarUrl, centerRank: m.centerRank ?? 0 });
      }
    });

    let renderedEdges = 0;
    for (const edge of edges) {
      if (renderedEdges >= MAX_RENDER_EDGES) break;
      if (edge.source_entity_id === edge.target_entity_id) continue;
      if (!graph.hasNode(edge.source_entity_id) || !graph.hasNode(edge.target_entity_id)) continue;
      try {
        graph.addEdgeWithKey(edge.id, edge.source_entity_id, edge.target_entity_id, {
          size: 1,
          invalid: !!edge.invalid_at,
          label: truncateText(edge.fact, 36),
        });
        renderedEdges++;
      } catch {
        // duplicate edge key — ignore
      }
    }
    graphRef.current = graph;

    // 圆形头像节点将名称胶囊下移至头像下方，避免遮挡人脸。
    const drawNodeLabel = (context: CanvasRenderingContext2D, data: any, settings: any) => {
      if (!data.label) return;
      const palette = getGraphPalette(isDarkRef.current);
      const fontSize = settings.labelSize as number;
      context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
      const textWidth = context.measureText(data.label).width;
      const padX = 5;
      const boxW = textWidth + padX * 2;
      const boxH = fontSize + 6;
      const labelY = data.hasAvatar ? data.y + Math.max(8, Number(data.size) || 9) + 10 : data.y;
      context.fillStyle = palette.labelBg;
      context.beginPath();
      context.roundRect(data.x - boxW / 2, labelY - boxH / 2, boxW, boxH, 4);
      context.fill();
      context.fillStyle = settings.labelColor?.color || palette.label;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(data.label, data.x, labelY);
    };

    // Draw the edge fact horizontally at the edge midpoint (never rotated along
    // the line). Only the hovered node's edges keep a label, so this stays sparse.
    const drawEdgeLabel = (
      context: CanvasRenderingContext2D,
      edgeData: any,
      sourceData: any,
      targetData: any,
      settings: any,
    ) => {
      if (!edgeData.label) return;
      const palette = getGraphPalette(isDarkRef.current);
      const fontSize = settings.edgeLabelSize as number;
      context.font = `${settings.edgeLabelWeight} ${fontSize}px ${settings.edgeLabelFont}`;
      const mx = (sourceData.x + targetData.x) / 2;
      const my = (sourceData.y + targetData.y) / 2;
      const textWidth = context.measureText(edgeData.label).width;
      const boxW = textWidth + 10;
      const boxH = fontSize + 6;
      context.fillStyle = palette.labelBg;
      context.beginPath();
      context.roundRect(mx - boxW / 2, my - boxH / 2, boxW, boxH, 4);
      context.fill();
      context.fillStyle = palette.label;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(edgeData.label, mx, my);
    };

    const renderer = new Sigma(graph, container, {
      renderLabels: true,
      renderEdgeLabels: true,
      labelColor: { color: getGraphPalette(isDarkRef.current).label },
      labelRenderedSizeThreshold: graph.order > HUGE_GRAPH_NODE_THRESHOLD ? 12 : 6,
      labelDensity: 1,
      labelGridCellSize: 70,
      labelWeight: '600',
      defaultDrawNodeLabel: drawNodeLabel,
      defaultDrawNodeHover: drawNodeLabel,
      defaultDrawEdgeLabel: drawEdgeLabel,
      minEdgeThickness: 1,
      minCameraRatio: 0.02,
      maxCameraRatio: 14,
      allowInvalidContainer: true,
      defaultNodeColor: getGraphPalette(isDarkRef.current).entity,
      defaultEdgeColor: getGraphPalette(isDarkRef.current).edge,
      nodeReducer: (node, data) => {
        const palette = getGraphPalette(isDarkRef.current);
        const res = { ...data };
        let color = data.centerRank
          ? palette.center
          : data.kind === 'speaker'
            ? palette.speaker
            : data.kind === 'placeholder'
              ? palette.placeholder
              : palette.entity;
        const highlight = highlightRef.current;
        if (highlight) {
          if (highlight.has(node)) {
            // Hovering a node reveals the name of every node it connects to.
            res.forceLabel = true;
          } else {
            color = palette.nodeDim;
            res.label = '';
          }
        }
        if (node === hoveredRef.current || node === focusedRef.current) {
          res.highlighted = true;
          res.forceLabel = true;
        }
        res.color = color;
        return res;
      },
      edgeReducer: (edge, data) => {
        const palette = getGraphPalette(isDarkRef.current);
        const res = { ...data };
        let color = data.invalid ? palette.edgeInvalid : palette.edge;
        const highlight = highlightRef.current;
        const hovered = hoveredRef.current;
        if (highlight) {
          const [src, tgt] = graph.extremities(edge);
          if (src === hovered || tgt === hovered) {
            // Show the fact only on the hovered node's own edges.
            res.forceLabel = true;
          } else {
            res.label = '';
            if (!highlight.has(src) || !highlight.has(tgt)) color = palette.edgeDim;
          }
        } else {
          // No persistent edge labels — they only appear on hover.
          res.label = '';
        }
        res.color = color;
        return res;
      },
    });
    sigmaRef.current = renderer;

    const drawAvatars = () => {
      const canvas = avatarCanvasRef.current;
      if (!canvas || !active) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width <= 0 || height <= 0) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const targetW = Math.round(width * dpr);
      const targetH = Math.round(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (avatarNodes.length === 0) return;

      const palette = getGraphPalette(isDarkRef.current);
      const highlight = highlightRef.current;
      const hovered = hoveredRef.current;
      const focused = focusedRef.current;

      for (const item of avatarNodes) {
        const img = avatarImagesRef.current.get(item.url);
        if (!img || !img.complete || img.naturalWidth <= 0) continue;
        const display = renderer.getNodeDisplayData(item.id);
        if (!display || display.hidden) continue;
        const vp = renderer.framedGraphToViewport({ x: display.x, y: display.y });
        const radius = Math.max(1.5, renderer.scaleSize(display.size));
        if (
          vp.x + radius < 0 ||
          vp.x - radius > width ||
          vp.y + radius < 0 ||
          vp.y - radius > height
        ) {
          continue;
        }
        const dimmed = highlight !== null && !highlight.has(item.id);
        ctx.save();
        ctx.globalAlpha = dimmed ? 0.2 : 1;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, vp.x - radius, vp.y - radius, radius * 2, radius * 2);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = dimmed ? 0.25 : 0.95;
        ctx.beginPath();
        ctx.arc(vp.x, vp.y, radius, 0, Math.PI * 2);
        ctx.lineWidth = item.id === hovered || item.id === focused ? 2.5 : 1.5;
        ctx.strokeStyle =
          item.centerRank > 0
            ? palette.center
            : item.id === hovered || item.id === focused
              ? '#ffffff'
              : palette.speaker;
        ctx.stroke();
        ctx.restore();
      }
    };

    renderer.on('afterRender', drawAvatars);
    // 预加载说话人 QQ 头像（不设 crossOrigin 以兼容 QQ 头像 CDN，加载失败自动退回蓝色圆点）
    for (const item of avatarNodes) {
      if (avatarImagesRef.current.has(item.url)) continue;
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        if (active) drawAvatars();
      };
      img.onerror = () => {
        avatarImagesRef.current.delete(item.url);
      };
      avatarImagesRef.current.set(item.url, img);
      img.src = item.url;
    }
    drawAvatars();

    renderer.on('enterNode', ({ node }) => {
      hoveredRef.current = node;
      const set = new Set<string>([node]);
      graph.forEachNeighbor(node, (neighbor) => set.add(neighbor));
      highlightRef.current = set;
      renderer.refresh({ skipIndexation: true });
      container.style.cursor = 'pointer';
    });
    renderer.on('leaveNode', () => {
      hoveredRef.current = null;
      highlightRef.current = null;
      renderer.refresh({ skipIndexation: true });
      container.style.cursor = 'grab';
    });
    renderer.on('clickNode', ({ node }) => {
      onNodeClickRef.current('entity', node);
    });

    // 鼠标中键按住拖动画布（解决密集节点处左键无法点空白平移的问题）
    let isMiddleDragging = false;
    let lastClientX = 0;
    let lastClientY = 0;

    const handlePointerDown = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
        isMiddleDragging = true;
        lastClientX = e.clientX;
        lastClientY = e.clientY;
        container.style.cursor = 'grabbing';
      }
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!isMiddleDragging) return;
      e.preventDefault();
      e.stopPropagation();

      const camera = renderer.getCamera();
      const rect = container.getBoundingClientRect();
      const prevX = lastClientX - rect.left;
      const prevY = lastClientY - rect.top;
      const curX = e.clientX - rect.left;
      const curY = e.clientY - rect.top;

      const p1 = renderer.viewportToFramedGraph({ x: prevX, y: prevY });
      const p2 = renderer.viewportToFramedGraph({ x: curX, y: curY });
      const dx = p1.x - p2.x;
      const dy = p1.y - p2.y;

      const state = camera.getState();
      camera.setState({
        x: state.x + dx,
        y: state.y + dy,
      });

      lastClientX = e.clientX;
      lastClientY = e.clientY;
    };

    const handlePointerUp = (e: MouseEvent) => {
      if (isMiddleDragging || e.button === 1) {
        isMiddleDragging = false;
        container.style.cursor = hoveredRef.current ? 'pointer' : 'grab';
      }
    };

    const handleAuxClick = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    container.addEventListener('mousedown', handlePointerDown);
    container.addEventListener('auxclick', handleAuxClick);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // Force layout (off the main thread) for graphs small enough to benefit;
    // larger graphs keep the deterministic phyllotaxis layout.
    let layoutTimer = 0;
    if (graph.order > 1 && graph.order <= FA2_MAX_NODES) {
      const settings = forceAtlas2.inferSettings(graph);
      const layout = new FA2Layout(graph, {
        settings: { ...settings, slowDown: 1 + Math.log(graph.order + 1) },
      });
      fa2Ref.current = layout;
      layout.start();
      setIsLayoutRunning(true);
      layoutTimer = window.setTimeout(
        () => {
          layout.stop();
          setIsLayoutRunning(false);
        },
        Math.min(9000, 2500 + graph.order),
      );
    }

    return () => {
      active = false;
      window.clearTimeout(layoutTimer);
      container.removeEventListener('mousedown', handlePointerDown);
      container.removeEventListener('auxclick', handleAuxClick);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      if (fa2Ref.current) {
        fa2Ref.current.kill();
        fa2Ref.current = null;
      }
      renderer.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      setIsLayoutRunning(false);
    };
  }, [nodeMeta, edges]);

  // Re-skin on theme change without rebuilding the graph.
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const palette = getGraphPalette(isDark);
    renderer.setSetting('labelColor', { color: palette.label });
    renderer.setSetting('defaultNodeColor', palette.entity);
    renderer.setSetting('defaultEdgeColor', palette.edge);
    renderer.refresh({ skipIndexation: true });
  }, [isDark]);

  const stopLayout = useCallback(() => {
    if (fa2Ref.current) {
      fa2Ref.current.stop();
      setIsLayoutRunning(false);
    }
  }, []);

  // 内嵌(docs 主页)面板滚出视口时，停掉力导图——它的 worker 会持续回传坐标并触发
  // sigma 重绘，离屏时是纯浪费且会拖累在屏面板的滚动。docs 端通过 postMessage→
  // main.tsx 派发 `gshub-embed-visibility` 事件。
  useEffect(() => {
    const onVis = (e: Event) => {
      const visible = (e as CustomEvent<{ visible: boolean }>).detail?.visible;
      if (visible === false) stopLayout();
    };
    window.addEventListener('gshub-embed-visibility', onVis);
    return () => window.removeEventListener('gshub-embed-visibility', onVis);
  }, [stopLayout]);

  const focusNode = useCallback((nodeId: string, options?: { closeResults?: boolean }) => {
    const renderer = sigmaRef.current;
    const graph = graphRef.current;
    if (!renderer || !graph?.hasNode(nodeId)) return;
    focusedRef.current = nodeId;
    setFocusedNodeId(nodeId);
    if (options?.closeResults) setNodeSearchQuery('');
    const display = renderer.getNodeDisplayData(nodeId);
    if (display) {
      const camera = renderer.getCamera();
      camera.animate(
        { x: display.x, y: display.y, ratio: Math.min(camera.ratio, 0.22) },
        { duration: 600 },
      );
    }
    renderer.refresh({ skipIndexation: true });
  }, []);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const first = nodeSearchResults[0];
      if (first) focusNode(first.id, { closeResults: true });
    },
    [focusNode, nodeSearchResults],
  );

  const toggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(() => {});
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(() => {});
    }
  }, []);

  // Sigma auto-tracks container resize; nudge a refresh after fullscreen transitions.
  useEffect(() => {
    const handleChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      window.setTimeout(() => sigmaRef.current?.refresh(), 60);
    };
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  return (
    <div
      ref={wrapperRef}
      className={cn('relative w-full', isFullscreen ? 'fixed inset-0 z-50 bg-background' : '')}
      style={isFullscreen ? { height: '100vh' } : { height: 'calc(100vh - 220px)', minHeight: 450 }}
    >
      <div
        ref={containerRef}
        className={cn('w-full h-full glass-card', isFullscreen ? '' : 'rounded-lg')}
        style={{ cursor: 'grab' }}
      />
      <canvas
        ref={avatarCanvasRef}
        className="pointer-events-none absolute inset-0 w-full h-full"
      />
      {/* 顶部悬浮工具栏：左 = 范围选择器 + 统计 + 孤立开关 + 搜索框；右 = 操作胶囊 + 缩放控件 */}
      <div className="absolute top-3 left-3 max-w-[calc(100%-130px)] sm:max-w-[calc(100%-250px)] flex flex-wrap items-center gap-2.5 z-10 pointer-events-auto">
        {/* 范围选择器（独立胶囊，scope 名较长给足宽度） */}
        {scopes && onScopeChange && (
          <div className="glass-float rounded-lg p-1 border border-border/50 shadow-sm shrink-0">
            <ScopeSelector
              value={selectedScope || 'all'}
              onChange={onScopeChange}
              scopes={scopes}
              allLabel={t('aiMemory.allScopes')}
              className="h-8 text-xs border-0 bg-transparent shadow-none w-[200px] sm:w-[260px]"
            />
          </div>
        )}

        {/* 实体与边数量统计徽标 */}
        <div className="glass-float hidden md:flex items-center gap-2 h-[42px] rounded-lg px-3 border border-border/50 shadow-sm text-xs shrink-0 select-none">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Brain className="w-3.5 h-3.5 text-primary" />
            <span className="text-muted-foreground">{t('aiMemory.legendEntity')}:</span>
            <span className="font-mono font-semibold tabular-nums">
              {visibleEntityCount.toLocaleString()}
            </span>
          </span>
          <span className="text-border/60">|</span>
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <GitBranch className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-muted-foreground">{t('aiMemory.statsEdges')}:</span>
            <span className="font-mono font-semibold tabular-nums">
              {edges.length.toLocaleString()}
            </span>
          </span>
        </div>

        {/* 显示孤立事物节点开关（默认隐藏 0 度非人节点，说话人始终保留） */}
        <label className="glass-float flex items-center gap-2 h-[42px] rounded-lg px-3 border border-border/50 shadow-sm text-xs text-muted-foreground shrink-0 cursor-pointer select-none">
          <Switch checked={showIsolatedItems} onCheckedChange={setShowIsolatedItems} />
          <span className="whitespace-nowrap">{t('aiMemory.showIsolatedItems')}</span>
        </label>

        {/* 节点搜索框（独立搜索控件，清晰明显的输入底板与边框） */}
        <form
          className="glass-float relative flex items-center rounded-lg px-2.5 py-1 border border-border/60 shadow-sm w-[150px] sm:w-[190px]"
          onSubmit={handleSearchSubmit}
        >
          <Search className="h-4 w-4 shrink-0 text-primary mr-1.5" />
          <Input
            value={nodeSearchQuery}
            onChange={(e) => setNodeSearchQuery(e.target.value)}
            placeholder="搜索节点名称或 ID，回车定位"
            className="h-8 border-0 bg-transparent shadow-none text-xs px-0 focus-visible:ring-0 placeholder:text-muted-foreground"
          />
          {nodeSearchQuery && (
            <button
              type="button"
              onClick={() => setNodeSearchQuery('')}
              className="text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          {nodeSearchQuery.trim() && (
            <div className="absolute top-full left-0 mt-2 w-[min(360px,calc(100vw-40px))] max-h-56 overflow-auto rounded-md border border-border/40 bg-popover/95 text-popover-foreground shadow-lg backdrop-blur z-50">
              {nodeSearchResults.length > 0 ? (
                nodeSearchResults.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className={cn(
                      'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent/60',
                      focusedNodeId === node.id && 'bg-accent/70',
                    )}
                    onClick={() => focusNode(node.id, { closeResults: true })}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{node.label}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {node.id}
                      </span>
                    </span>
                    <Badge
                      variant={node.centerRank ? 'default' : 'outline'}
                      className="shrink-0 text-[10px]"
                    >
                      {node.centerRank ? `TOP ${node.centerRank}` : `${node.degree} 线`}
                    </Badge>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">未找到匹配节点</div>
              )}
            </div>
          )}
        </form>
      </div>
      {/* 右上角：操作胶囊（清除当前范围记忆 & 刷新）+ 缩放控件 */}
      <div className="absolute top-3 right-3 z-10 flex flex-col items-end gap-2">
        {(onClearMemory || onRefresh) && (
          <div className="glass-float flex items-center gap-1 rounded-lg p-1 border border-border/50 shadow-sm shrink-0">
            {onClearMemory && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={onClearMemory}
                disabled={selectedScope === 'all' || !selectedScope}
                title={t('aiMemory.clearMemory')}
                aria-label={t('aiMemory.clearMemory')}
              >
                <Trash2 className="w-3.5 h-3.5 sm:mr-1 text-destructive/80" />
                <span className="hidden sm:inline">{t('aiMemory.clearMemory')}</span>
              </Button>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={onRefresh}
                title={t('common.refresh')}
                aria-label={t('common.refresh')}
              >
                <RefreshCw className="w-3.5 h-3.5 sm:mr-1" />
                <span className="hidden sm:inline">{t('common.refresh')}</span>
              </Button>
            )}
          </div>
        )}
        <div className="flex flex-col gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur"
            onClick={() => sigmaRef.current?.getCamera().animatedZoom()}
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur"
            onClick={() => sigmaRef.current?.getCamera().animatedUnzoom()}
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 bg-background/80 backdrop-blur"
            onClick={toggleFullscreen}
          >
            <Maximize2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
      {/* Layout indicator */}
      {isLayoutRunning && (
        <button
          type="button"
          onClick={stopLayout}
          className="absolute bottom-16 top-auto left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md bg-background/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground sm:bottom-auto sm:top-3"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在计算布局…点击停止
        </button>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-3 md:gap-4 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded-md px-3 py-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-400/70" />
          {t('aiMemory.legendSpeaker')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-400/70" />
          {t('aiMemory.legendEntity')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-yellow-400/80" />
          中心节点 TOP3
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0 border-t-2 border-red-400/70" />
          {t('aiMemory.legendInvalid')}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatsCard({
  title,
  value,
  icon: Icon,
  isGlass,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  isGlass: boolean;
}) {
  return (
    <Card className={cn('glass-card')}>
      <CardContent className="p-2 sm:p-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 shrink-0">
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground truncate">{title}</p>
            <p className="text-sm sm:text-base font-bold truncate leading-tight">
              {value.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScopeCard({
  scope,
  onDelete,
  onOpen,
}: {
  scope: MemoryScope;
  onDelete: () => void;
  onOpen: (tab: string) => void;
}) {
  const { t } = useLanguage();
  const { type, id } = formatScopeType(scope.scope_key);
  const typeLabelKeys: Record<string, string> = {
    group: 'aiMemory.scopeTypeGroup',
    user_global: 'aiMemory.scopeTypeUserGlobal',
    user_in_group: 'aiMemory.scopeTypeUserInGroup',
    self: 'aiMemory.scopeTypeSelf',
    unknown: 'aiMemory.scopeTypeUnknown',
  };
  const typeLabel = typeLabelKeys[type] ? t(typeLabelKeys[type]) : type;
  const displayName = (scope.display_name || '').trim() || id;
  const scopeIdLabel = scope.scope_id || id;
  const metricButtonClass =
    'w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const openMetric = (e: ReactMouseEvent<HTMLButtonElement>, tab: string) => {
    e.stopPropagation();
    onOpen(tab);
  };
  return (
    <Card
      role="button"
      tabIndex={0}
      className={cn(
        'group cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        'glass-card',
      )}
      onClick={() => onOpen('graph')}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        onOpen('graph');
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <ScopeAvatar scope={scope} type={type} id={id} name={displayName} />
            <div className="min-w-0">
              <CardTitle className="text-base leading-tight truncate">{displayName}</CardTitle>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground truncate">
                {scopeIdLabel}
              </p>
              {type === 'group' && <ScopeSpeakerPreviews scope={scope} />}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant="outline" className="shrink-0">
              {typeLabel}
            </Badge>
            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 text-sm">
          <button
            type="button"
            className={metricButtonClass}
            onClick={(e) => openMetric(e, 'episodes')}
          >
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {t('aiMemory.tabEpisodes')}
            </p>
            <p className="font-semibold tabular-nums">{scope.episode_count}</p>
          </button>
          <button
            type="button"
            className={metricButtonClass}
            onClick={(e) => openMetric(e, 'entities')}
          >
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {t('aiMemory.tabEntities')}
            </p>
            <p className="font-semibold tabular-nums">{scope.entity_count}</p>
          </button>
          <button
            type="button"
            className={metricButtonClass}
            onClick={(e) => openMetric(e, 'edges')}
          >
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {t('aiMemory.tabEdges')}
            </p>
            <p className="font-semibold tabular-nums">{scope.edge_count}</p>
          </button>
          <button
            type="button"
            className={metricButtonClass}
            onClick={(e) => openMetric(e, 'threads')}
          >
            <p className="text-xs text-muted-foreground whitespace-nowrap">
              {t('aiMemory.statsThreads')}
            </p>
            <p className="font-semibold tabular-nums">{scope.thread_count ?? 0}</p>
          </button>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            {t('common.delete')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function EntityNode({
  entity,
  isGlass,
  onClick,
  onDelete,
  worldHub,
}: {
  entity: Entity;
  isGlass: boolean;
  onClick: () => void;
  onDelete?: () => void;
  worldHub?: CognitionNode | null;
}) {
  const { t } = useLanguage();
  const [imgErr, setImgErr] = useState(false);
  const articleCount = worldHub?.attachments?.length ?? 0;
  const aliases = entity.aliases ?? [];
  const hasAvatar = Boolean(
    entity.avatar_url && /^https?:\/\//i.test(entity.avatar_url) && !imgErr,
  );
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50 h-full',
        'glass-card',
        entity.is_speaker && 'border-l-4 border-l-primary/60',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5 flex-1 min-w-0">
            {entity.is_speaker && (
              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-primary/40 bg-primary/15 flex items-center justify-center text-xs font-semibold text-primary mt-0.5">
                {hasAvatar ? (
                  <img
                    src={entity.avatar_url}
                    alt={entity.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={() => setImgErr(true)}
                  />
                ) : (
                  (entity.name || '?').slice(0, 1).toUpperCase()
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{entity.name}</p>
              {entity.summary && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {truncateText(entity.summary, 100)}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {entity.is_speaker && <Badge variant="secondary">Speaker</Badge>}
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-80 sm:opacity-0 sm:group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        {(aliases.length > 0 ||
          entity.tag.length > 0 ||
          worldHub ||
          (entity.self_edge_count ?? 0) > 0 ||
          (entity.relation_edge_count ?? 0) > 0) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {aliases.slice(0, 2).map((al) => (
              <Badge key={`al-${al}`} variant="secondary" className="text-[10px]">
                {al}
              </Badge>
            ))}
            {(entity.self_edge_count ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {t('aiMemory.entityTabSelfAttrs')} {entity.self_edge_count}
              </Badge>
            )}
            {(entity.relation_edge_count ?? 0) > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {t('aiMemory.entityTabRelations')} {entity.relation_edge_count}
              </Badge>
            )}
            {entity.tag.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {worldHub && (
              <Badge variant="outline" className="text-xs gap-1">
                <Globe className="w-3 h-3" />
                {worldHub.title || worldHub.ref}
                {articleCount > 0 ? ` · ${articleCount}` : ''}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EdgeItem({
  edge,
  isGlass,
  onClick,
  sourceName,
  targetName,
}: {
  edge: Edge;
  isGlass: boolean;
  onClick: () => void;
  sourceName?: string;
  targetName?: string;
}) {
  const { t } = useLanguage();
  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        'glass-card',
        edge.invalid_at && 'opacity-60',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-medium truncate max-w-[120px] min-w-0">
            {sourceName || edge.source_entity_id}
          </span>
          <ChevronRight className="w-4 h-4 shrink-0 text-primary/50" />
          <span className="font-medium truncate max-w-[120px] min-w-0">
            {targetName || edge.target_entity_id}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{edge.fact}</p>
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{formatDate(edge.valid_at)}</span>
          {edge.edge_kind && (
            <Badge variant="outline" className="text-xs">
              {t(`aiMemory.edgeKind_${edge.edge_kind}`)}
            </Badge>
          )}
          {edge.slot_key && (
            <Badge variant="secondary" className="text-xs font-mono">
              {edge.slot_key}
            </Badge>
          )}
          {edge.resolution_state && edge.resolution_state !== 'active' && (
            <Badge
              variant={edge.resolution_state === 'contradicted' ? 'destructive' : 'outline'}
              className="text-xs"
            >
              {t(`aiMemory.edgeState_${edge.resolution_state}`)}
            </Badge>
          )}
          {edge.invalid_at && (
            <Badge variant="destructive" className="text-xs">
              {t('aiMemory.legendInvalid')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ParticipantAvatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const [failed, setFailed] = useState(false);
  const valid = Boolean(avatarUrl && /^https?:\/\//i.test(avatarUrl) && !failed);
  return (
    <span className="w-5 h-5 rounded-full overflow-hidden bg-primary/15 text-primary flex items-center justify-center text-[10px] font-semibold shrink-0">
      {valid ? (
        <img
          src={avatarUrl}
          alt={name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (name || '?').slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

function ScopeSelector({
  value,
  onChange,
  scopes,
  allLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  scopes: MemoryScope[];
  allLabel: string;
  className?: string;
}) {
  const scopeByKey = useMemo(() => {
    const map = new Map<string, MemoryScope>();
    for (const s of scopes) {
      map.set(s.scope_key, s);
    }
    return map;
  }, [scopes]);
  const options = useMemo(
    () => [
      allLabel,
      ...scopes
        .filter(
          (s) =>
            s.episode_count +
              s.entity_count +
              s.edge_count +
              (s.category_count ?? 0) +
              (s.thread_count ?? 0) +
              (s.preference_count ?? 0) >
            0,
        )
        .map((s) => s.scope_key),
    ],
    [allLabel, scopes],
  );
  const displayValue = value === 'all' ? allLabel : value;

  const formatLabel = useCallback(
    (rawValue: string) => {
      if (rawValue === allLabel) return allLabel;
      const { type, id } = formatScopeType(rawValue);
      const tag =
        type === 'group'
          ? '群聊'
          : type === 'user_global'
            ? '用户'
            : type === 'self'
              ? '人格'
              : type;
      return `${tag} ${id} (${rawValue})`;
    },
    [allLabel],
  );

  const renderOption = useCallback(
    (rawValue: string) => {
      if (rawValue === allLabel) return allLabel;
      const { type, id } = formatScopeType(rawValue);
      const s = scopeByKey.get(rawValue);
      const tag =
        type === 'group'
          ? '群聊'
          : type === 'user_global'
            ? '用户'
            : type === 'self'
              ? '人格'
              : type;
      const badgeColor =
        type === 'group'
          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
          : type === 'user_global'
            ? 'bg-blue-500/15 text-blue-500 border-blue-500/30'
            : 'bg-muted text-muted-foreground border-border/50';
      return (
        <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
          <span
            className={cn(
              'shrink-0 rounded border px-1 py-0.5 text-[10px] font-medium leading-none',
              badgeColor,
            )}
          >
            {tag}
          </span>
          <span className="font-mono text-xs truncate">{id}</span>
          {s && (
            <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
              {type === 'user_global' &&
              (s.entity_count ?? 0) === 0 &&
              (s.edge_count ?? 0) === 0 &&
              (s.preference_count ?? 0) > 0
                ? `偏好:${s.preference_count}`
                : `${s.entity_count ?? 0}/${s.edge_count ?? 0}`}
            </span>
          )}
        </span>
      );
    },
    [allLabel, scopeByKey],
  );

  return (
    <InputWithDropdown
      value={displayValue}
      onChange={(val) => {
        onChange(val === allLabel ? 'all' : val);
      }}
      options={options}
      formatLabel={formatLabel}
      renderOption={renderOption}
      placeholder={allLabel}
      className={className}
      popoverWidth="w-[360px] max-w-[calc(100vw-1.5rem)]"
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIMemoryPage() {
  const { style, mode } = useTheme();
  const { t } = useLanguage();
  const isGlass = style !== 'solid';
  const isDark = mode === 'dark';

  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [scopes, setScopes] = useState<MemoryScope[]>([]);
  const [hierGraphStatus, setHierGraphStatus] = useState<HierGraphStatus | null>(null);
  const [memorySettingsOpen, setMemorySettingsOpen] = useState(false);
  const [, setMemorySettingsVersion] = useState(0);
  const [config, setConfig] = useState<MemoryConfig | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLoadingGraph, setIsLoadingGraph] = useState(true);
  const loadedTabDataRef = useRef<Set<string>>(new Set());
  const [isReconciling, setIsReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodePage, setEpisodePage] = useState(1);
  const [entityPage, setEntityPage] = useState(1);
  const [edgePage, setEdgePage] = useState(1);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [totalEntities, setTotalEntities] = useState(0);
  const [totalEdges, setTotalEdges] = useState(0);
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityFilterSpeaker, setEntityFilterSpeaker] = useState<boolean | undefined>(undefined);
  const [selectedEpisode, setSelectedEpisode] = useState<
    (Episode & { mentioned_entities: Entity[] }) | null
  >(null);
  const [selectedEntity, setSelectedEntity] = useState<EntityDetailData | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<
    ({ source_entity: Entity | null; target_entity: Entity | null } & Edge) | null
  >(null);
  const [selectedThreadDetail, setSelectedThreadDetail] = useState<ThreadDetail | null>(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [debugEdges, setDebugEdges] = useState<AgentDebugMemoryEdge[]>([]);
  const [debugConflicts, setDebugConflicts] = useState<AgentDebugMemoryConflict[]>([]);
  const [includeInvalidEdges, setIncludeInvalidEdges] = useState(false);
  const [includeEdgeHistory, setIncludeEdgeHistory] = useState(false);
  const [threads, setThreads] = useState<MemoryThread[]>([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [threadPage, setThreadPage] = useState(1);
  const [showArchivedThreads, setShowArchivedThreads] = useState(false);
  const [selectedParticipantUid, setSelectedParticipantUid] = useState('');
  const [selectedParticipantName, setSelectedParticipantName] = useState('');
  const [isLoadingThreads, setIsLoadingThreads] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationV21Report | null>(null);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingInvalidateEdge, setPendingInvalidateEdge] = useState<Pick<
    Edge,
    'id' | 'fact' | 'source_entity_id' | 'target_entity_id'
  > | null>(null);
  const [invalidateEdgeLoading, setInvalidateEdgeLoading] = useState(false);
  const [clearMemoryDialogOpen, setClearMemoryDialogOpen] = useState(false);
  const [clearMemoryLoading, setClearMemoryLoading] = useState(false);
  const [dialogType, setDialogType] = useState<'episode' | 'entity' | 'edge' | 'thread' | 'world'>(
    'episode',
  );
  const [cognitionNodes, setCognitionNodes] = useState<CognitionNode[]>([]);
  const [selectedWorldHub, setSelectedWorldHub] = useState<CognitionNode | null>(null);
  const [previewArticle, setPreviewArticle] = useState<CognitionAttachment | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [totalPreferences, setTotalPreferences] = useState(0);
  const [preferencePage, setPreferencePage] = useState(1);
  const [preferenceSearch, setPreferenceSearch] = useState<string>('');
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [preferenceFilter, setPreferenceFilter] = useState<
    'all' | 'active' | 'inactive' | 'correction'
  >('all');
  const [preferencePolarityFilter, setPreferencePolarityFilter] = useState<'all' | 'do' | 'dont'>(
    'all',
  );
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null);
  const [editingPreferenceDraft, setEditingPreferenceDraft] = useState<{
    preference_rule: string;
    polarity: 'do' | 'dont';
    target_context: string;
    is_active: boolean;
  } | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const [deletingPreference, setDeletingPreference] = useState<Preference | null>(null);
  const [deletingPreferenceLoading, setDeletingPreferenceLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [statsData, scopesData] = await Promise.all([
          memoryApi.getStats().catch(() => null),
          memoryApi.getScopes().catch(() => null),
        ]);
        if (statsData) {
          setStats(statsData);
          if (typeof statsData.preference_count === 'number') {
            setTotalPreferences(statsData.preference_count);
          }
        }

        let targetScope = 'all';
        const cleanScopes = sanitizeScopes(scopesData);
        if (cleanScopes.length > 0) {
          setScopes(cleanScopes);
          const firstWithData = cleanScopes.find(
            (s) =>
              s.scope_key !== 'all' &&
              !s.scope_key.includes('assistant') &&
              ((s.entity_count ?? 0) > 0 || (s.edge_count ?? 0) > 0),
          );
          const firstValid = cleanScopes.find(
            (s) => s.scope_key !== 'all' && !s.scope_key.includes('assistant'),
          );
          targetScope = firstWithData
            ? firstWithData.scope_key
            : firstValid
              ? firstValid.scope_key
              : 'all';
          setSelectedScope(targetScope);
        }

        // 次要元数据不挡首屏
        void Promise.all([
          memoryApi.getHierGraphStatus({}).catch(() => null),
          memoryApi.getConfig().catch(() => null),
          memoryApi.getMigrationReport().catch(() => null),
        ]).then(([hierData, configData, migData]) => {
          if (hierData) setHierGraphStatus(hierData);
          if (configData) setConfig(configData);
          if (migData) setMigrationReport(migData);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : t('aiMemory.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [t]);

  const fetchEpisodes = async (page = 1, scopeOverride?: string): Promise<boolean> => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const params: { page: number; page_size: number; scope_key?: string; all_scopes?: boolean } =
        { page, page_size: 20 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEpisodes(params);
      setEpisodes(data.items);
      setTotalEpisodes(data.total);
      setEpisodePage(page);
      return true;
    } catch {
      toast.error(t('aiMemory.loadEpisodesFailed'));
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchEntities = async (
    page = 1,
    scopeOverride?: string,
    opts?: { search?: string; isSpeaker?: boolean | null },
  ): Promise<boolean> => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const searchVal = opts && 'search' in opts ? (opts.search ?? '') : entitySearch;
      const speakerVal =
        opts && 'isSpeaker' in opts ? (opts.isSpeaker ?? undefined) : entityFilterSpeaker;
      const params: {
        page: number;
        page_size: number;
        scope_key?: string;
        all_scopes?: boolean;
        search?: string;
        is_speaker?: boolean;
      } = {
        page: 1,
        page_size: 9999,
        search: searchVal || undefined,
        is_speaker: speakerVal,
      };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEntities(params);
      setEntities(data.items);
      setTotalEntities(data.total);
      setEntityPage(page);
      return true;
    } catch {
      toast.error(t('aiMemory.loadEntitiesFailed'));
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchEdges = async (
    page = 1,
    scopeOverride?: string,
    opts?: { includeHistory?: boolean },
  ): Promise<boolean> => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const includeHistory = opts?.includeHistory ?? includeEdgeHistory;
      const params: {
        page: number;
        page_size: number;
        scope_key?: string;
        all_scopes?: boolean;
        include_history?: boolean;
      } = { page: 1, page_size: 9999, include_history: includeHistory };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEdges(params);
      setEdges(data.items);
      setTotalEdges(data.total);
      setEdgePage(page);
      return true;
    } catch {
      toast.error(t('aiMemory.loadEdgesFailed'));
      return false;
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchThreads = async (
    page = 1,
    scopeOverride?: string,
    opts?: { includeArchived?: boolean; participantUid?: string },
  ): Promise<boolean> => {
    try {
      setIsLoadingThreads(true);
      const scope = scopeOverride ?? selectedScope;
      const includeArchived = opts?.includeArchived ?? showArchivedThreads;
      const participantUid = opts?.participantUid ?? selectedParticipantUid;
      const params: {
        page: number;
        page_size: number;
        scope_key?: string;
        include_archived?: boolean;
        participant_uid?: string;
      } = {
        page,
        page_size: 20,
        include_archived: includeArchived,
      };
      if (scope !== 'all') {
        params.scope_key = scope;
      }
      if (participantUid) {
        params.participant_uid = participantUid;
      }
      const data = await memoryApi.getThreads(params);
      setThreads(data.items);
      setTotalThreads(data.total);
      setThreadPage(page);
      return true;
    } catch {
      toast.error(t('aiMemory.loadThreadsFailed'));
      return false;
    } finally {
      setIsLoadingThreads(false);
    }
  };

  const fetchCognition = async (scopeOverride?: string): Promise<boolean> => {
    const scope = scopeOverride ?? selectedScope;
    try {
      const [publicData, scopedData] = await Promise.all([
        cognitionApi.getNodes({ limit: 100 }),
        scope && scope !== 'all'
          ? cognitionApi.getNodes({ scope_key: scope, limit: 100 })
          : Promise.resolve({ nodes: [] as CognitionNode[] }),
      ]);
      setCognitionNodes(mergeCognitionNodes(publicData.nodes, scopedData.nodes));
      return true;
    } catch (error) {
      if (isCognitionBackendMissing(error)) {
        console.warn('[AIMemoryPage] /api/cognition/nodes 不可用：请升级 gsuid_core。', error);
      } else {
        console.warn('[AIMemoryPage] load cognition overlay failed:', error);
      }
      setCognitionNodes([]);
      return false;
    }
  };

  const worldHubs = useMemo(() => cognitionNodes.filter(isWorldHub), [cognitionNodes]);

  const fetchDebugMemory = async (scopeOverride?: string): Promise<boolean> => {
    const scope = scopeOverride ?? selectedScope;
    if (!scope || scope === 'all') {
      setDebugEdges([]);
      setDebugConflicts([]);
      return true;
    }
    try {
      setIsLoadingDebug(true);
      const [edgeData, conflictData] = await Promise.all([
        agentDebugApi.getMemoryEdges({
          scope_key: scope,
          include_invalid: includeInvalidEdges,
          limit: 1000,
        }),
        agentDebugApi.getMemoryConflicts({ scope_key: scope, limit: 500 }),
      ]);
      setDebugEdges(edgeData);
      setDebugConflicts(conflictData);
      return true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg ? `加载调试记忆失败: ${errorMsg}` : '加载调试记忆失败');
      return false;
    } finally {
      setIsLoadingDebug(false);
    }
  };

  const requestInvalidateEdge = (
    edge: Pick<Edge, 'id' | 'fact' | 'source_entity_id' | 'target_entity_id'>,
  ) => {
    setPendingInvalidateEdge(edge);
  };

  const confirmInvalidateEdge = async () => {
    if (!pendingInvalidateEdge) return;
    try {
      setInvalidateEdgeLoading(true);
      await agentDebugApi.invalidateMemoryEdge(pendingInvalidateEdge.id);
      toast.success('Edge 已标记为失效');
      setPendingInvalidateEdge(null);
      await fetchEdges(edgePage);
      if (selectedScope !== 'all') await fetchDebugMemory();
      if (dialogType === 'edge' && selectedEdge?.id === pendingInvalidateEdge.id) {
        setSelectedEdge({ ...selectedEdge, invalid_at: new Date().toISOString() });
      }
      if (dialogType === 'entity' && selectedEntity) {
        const refreshed = await memoryApi.getEntityDetail(selectedEntity.id).catch(() => null);
        if (refreshed) setSelectedEntity(refreshed);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || 'Edge 失效失败');
    } finally {
      setInvalidateEdgeLoading(false);
    }
  };

  const refreshAfterEntityMutation = async () => {
    const [statsData, scopesData] = await Promise.all([
      memoryApi.getStats().catch(() => null),
      memoryApi.getScopes().catch(() => null),
      fetchEntities(entityPage),
      fetchEdges(edgePage),
      fetchCognition(),
    ]);
    if (statsData) setStats(statsData);
    if (scopesData) setScopes(sanitizeScopes(scopesData));
  };

  const handlePatchEntity = async (
    entityId: string,
    payload: {
      name?: string;
      summary?: string;
      entity_kind?: string;
      aliases?: string[];
      promote_pending_alias?: string;
      dismiss_pending_alias?: string;
    },
  ): Promise<EntityDetailData | null> => {
    try {
      const updated = await memoryApi.patchEntity(entityId, payload);
      setSelectedEntity(updated);
      void refreshAfterEntityMutation();
      return updated;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg || t('aiMemory.loadFailed'));
      return null;
    }
  };

  const handleMergeEntity = async (
    sourceId: string,
    targetId: string,
  ): Promise<EntityDetailData | null> => {
    try {
      const merged = await memoryApi.mergeEntity(sourceId, targetId);
      setSelectedEntity(merged);
      void refreshAfterEntityMutation();
      return merged;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg || t('aiMemory.loadFailed'));
      return null;
    }
  };

  const handleSplitEntity = async (
    sourceId: string,
    payload: { edge_ids: string[]; new_name: string; entity_kind: string; summary: string },
  ): Promise<{ new_entity: EntityDetailData | null; moved_edges: number } | null> => {
    try {
      const result = await memoryApi.splitEntity(sourceId, payload);
      const refreshed = await memoryApi.getEntityDetail(sourceId).catch(() => null);
      if (refreshed) setSelectedEntity(refreshed);
      void refreshAfterEntityMutation();
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      toast.error(msg || t('aiMemory.loadFailed'));
      return null;
    }
  };

  const loadTabData = async (tab: string, scope: string) => {
    const key = `${tab}:${scope}`;
    if (loadedTabDataRef.current.has(key)) return;
    loadedTabDataRef.current.add(key);
    let ok = true;
    switch (tab) {
      case 'graph':
        setIsLoadingGraph(true);
        try {
          const results = await Promise.all([
            fetchEntities(1, scope, { search: '', isSpeaker: null }),
            fetchEdges(1, scope, { includeHistory: false }),
            fetchCognition(scope),
          ]);
          ok = results.every(Boolean);
          if (ok) {
            if (!entitySearch && entityFilterSpeaker === undefined) {
              loadedTabDataRef.current.add(`entities:${scope}`);
            }
            if (!includeEdgeHistory) {
              loadedTabDataRef.current.add(`edges:${scope}`);
            }
            loadedTabDataRef.current.add(`world:${scope}`);
          }
        } finally {
          setIsLoadingGraph(false);
        }
        break;
      case 'episodes':
        ok = await fetchEpisodes(1, scope);
        break;
      case 'entities':
        ok = await fetchEntities(1, scope);
        break;
      case 'edges':
        ok = await fetchEdges(1, scope);
        break;
      case 'threads':
        ok = await fetchThreads(1, scope);
        break;
      case 'preferences':
        ok = await fetchPreferences(1, scope);
        break;
      case 'debug':
        ok = await fetchDebugMemory(scope);
        break;
      case 'world':
        ok = await fetchCognition(scope);
        break;
      default:
        break;
    }
    if (!ok) loadedTabDataRef.current.delete(key);
  };

  const handleScopeChange = (scope: string) => {
    loadedTabDataRef.current.clear();
    setSelectedScope(scope);
    setEpisodePage(1);
    setEntityPage(1);
    setEdgePage(1);
    setThreadPage(1);
    setSelectedParticipantUid('');
    setSelectedParticipantName('');
    void loadTabData(activeTab, scope);
  };

  const handleOpenScope = (scope: string, tab = 'graph') => {
    handleScopeChange(scope);
    setActiveTab(tab);
  };

  useEffect(() => {
    if (isLoading) return;
    void loadTabData(activeTab, selectedScope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isLoading]);

  const handleDeleteScope = async (scopeKey: string) => {
    if (!confirm(t('aiMemory.confirmDeleteScope'))) return;
    try {
      await memoryApi.deleteScope(scopeKey);
      toast.success(t('aiMemory.scopeDeleted'));
      const scopesData = await memoryApi.getScopes();
      setScopes(sanitizeScopes(scopesData));
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg
          ? `${t('aiMemory.deleteScopeFailed')}: ${errorMsg}`
          : t('aiMemory.deleteScopeFailed'),
      );
    }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEpisode'))) return;
    try {
      await memoryApi.deleteEpisode(episodeId);
      toast.success(t('aiMemory.episodeDeleted'));
      fetchEpisodes(episodePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed'),
      );
    }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEntity'))) return;
    try {
      await memoryApi.deleteEntity(entityId);
      toast.success(t('aiMemory.entityDeleted'));
      fetchEntities(entityPage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed'),
      );
    }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEdge'))) return;
    try {
      await memoryApi.deleteEdge(edgeId);
      toast.success(t('aiMemory.edgeDeleted'));
      fetchEdges(edgePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed'),
      );
    }
  };

  const fetchPreferences = async (
    page = 1,
    scopeOverride?: string,
    opts?: {
      keyword?: string;
      filter?: 'all' | 'active' | 'inactive' | 'correction';
      polarity?: 'all' | 'do' | 'dont';
    },
  ): Promise<boolean> => {
    try {
      setIsLoadingPreferences(true);
      const scope = scopeOverride ?? selectedScope;
      const kw = (opts && 'keyword' in opts ? (opts.keyword ?? '') : preferenceSearch).trim();
      const filterVal = opts?.filter ?? preferenceFilter;
      const polarityVal = opts?.polarity ?? preferencePolarityFilter;
      const params: {
        page: number;
        page_size: number;
        scope_key?: string;
        all_scopes?: boolean;
        is_active?: boolean;
        is_correction?: boolean;
        polarity?: 'do' | 'dont';
        keyword?: string;
      } = { page, page_size: 20 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      if (kw) params.keyword = kw;
      if (filterVal === 'active') params.is_active = true;
      if (filterVal === 'inactive') params.is_active = false;
      if (filterVal === 'correction') params.is_correction = true;
      if (polarityVal !== 'all') params.polarity = polarityVal;
      const data = await memoryApi.getPreferences(params);
      setPreferences(data.items);
      setTotalPreferences(data.total);
      setPreferencePage(page);
      return true;
    } catch {
      toast.error(t('aiMemory.loadPreferencesFailed'));
      return false;
    } finally {
      setIsLoadingPreferences(false);
    }
  };

  const startEditPreference = (pref: Preference) => {
    setEditingPreference(pref);
    setEditingPreferenceDraft({
      preference_rule: pref.preference_rule,
      polarity: pref.polarity,
      target_context: pref.target_context,
      is_active: pref.is_active,
    });
  };

  const cancelEditPreference = () => {
    setEditingPreference(null);
    setEditingPreferenceDraft(null);
  };

  const saveEditPreference = async () => {
    if (!editingPreference || !editingPreferenceDraft) return;
    try {
      setSavingPreference(true);
      const updated = await memoryApi.updatePreference(
        editingPreference.id,
        editingPreferenceDraft,
      );
      toast.success(t('aiMemory.preferenceUpdated'));
      setEditingPreference(updated);
      setEditingPreferenceDraft({
        preference_rule: updated.preference_rule,
        polarity: updated.polarity,
        target_context: updated.target_context,
        is_active: updated.is_active,
      });
      await fetchPreferences(preferencePage);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg
          ? `${t('aiMemory.preferenceUpdateFailed')}: ${errorMsg}`
          : t('aiMemory.preferenceUpdateFailed'),
      );
    } finally {
      setSavingPreference(false);
    }
  };

  const togglePreferenceActive = async (pref: Preference) => {
    try {
      const updated = await memoryApi.updatePreference(pref.id, { is_active: !pref.is_active });
      toast.success(t('aiMemory.preferenceUpdated'));
      // Reflect change in local list immediately
      setPreferences((prev) => prev.map((p) => (p.id === pref.id ? updated : p)));
      if (editingPreference?.id === pref.id) {
        setEditingPreference(updated);
        setEditingPreferenceDraft((d) => (d ? { ...d, is_active: updated.is_active } : d));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg
          ? `${t('aiMemory.preferenceUpdateFailed')}: ${errorMsg}`
          : t('aiMemory.preferenceUpdateFailed'),
      );
    }
  };

  const confirmDeletePreference = async () => {
    if (!deletingPreference) return;
    try {
      setDeletingPreferenceLoading(true);
      await memoryApi.deletePreference(deletingPreference.id);
      toast.success(t('aiMemory.preferenceDeleted'));
      setDeletingPreference(null);
      await fetchPreferences(preferencePage);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(
        errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed'),
      );
    } finally {
      setDeletingPreferenceLoading(false);
    }
  };

  const hydrateWorldHub = async (hub: CognitionNode) => {
    setSelectedWorldHub(hub);
    if (hub.id == null) return;
    if ((hub.attachments?.length ?? 0) > 0) return;
    try {
      const detail = await cognitionApi.getNode(hub.id, {
        scope_key: selectedScope !== 'all' ? selectedScope : undefined,
      });
      setSelectedWorldHub(detail);
    } catch {
      // keep the list payload
    }
  };

  const handleReconcileIndex = async () => {
    if (!selectedScope || selectedScope === 'all') {
      toast.error(t('aiMemory.reconcileFailed'));
      return;
    }
    try {
      setIsReconciling(true);
      const result = await memoryApi.rebuildHierGraph({
        scope_key: selectedScope,
      });
      toast.success(
        t('aiMemory.reconcileDone', {
          rows: result.fts_rows,
          vectors: result.vectors_repaired,
        }),
      );
      const statsData = await memoryApi.getStats().catch(() => null);
      if (statsData) setStats(statsData);
      if (activeTab === 'threads') {
        await fetchThreads(threadPage);
      }
    } catch {
      toast.error(t('aiMemory.reconcileFailed'));
    } finally {
      setIsReconciling(false);
    }
  };

  const openDetailDialog = async (
    type: 'episode' | 'entity' | 'edge' | 'thread' | 'world',
    id: string,
  ) => {
    setDialogType(type);
    setDialogOpen(true);
    if (type === 'world') {
      const hub =
        worldHubs.find((h) => worldGraphId(h) === id) ??
        cognitionNodes.find((n) => worldGraphId(n) === id);
      if (!hub) {
        setDialogOpen(false);
        return;
      }
      await hydrateWorldHub(hub);
      return;
    }
    try {
      switch (type) {
        case 'episode': {
          const data = await memoryApi.getEpisodeDetail(id);
          setSelectedEpisode(data);
          break;
        }
        case 'entity': {
          const data = await memoryApi.getEntityDetail(id);
          setSelectedEntity(data);
          if (!entities.some((e) => e.scope_key === data.scope_key)) {
            void fetchEntities(1, data.scope_key, { search: '', isSpeaker: null });
          }
          break;
        }
        case 'edge': {
          const data = await memoryApi.getEdgeDetail(id);
          setSelectedEdge(data);
          break;
        }
        case 'thread': {
          const data = await memoryApi.getThreadDetail(id);
          setSelectedThreadDetail(data);
          break;
        }
      }
    } catch {
      // Fallback: use inline data from list when detail API is unavailable
      switch (type) {
        case 'episode': {
          const ep = episodes.find((e) => e.id === id);
          if (ep) setSelectedEpisode({ ...ep, mentioned_entities: [] });
          else setDialogOpen(false);
          break;
        }
        case 'entity': {
          const en = entities.find((e) => e.id === id);
          if (en) setSelectedEntity(en);
          else setDialogOpen(false);
          break;
        }
        case 'edge': {
          const ed = edges.find((e) => e.id === id);
          if (ed) {
            const sourceEntity = entities.find((e) => e.id === ed.source_entity_id);
            const targetEntity = entities.find((e) => e.id === ed.target_entity_id);
            setSelectedEdge({
              ...ed,
              source_entity: sourceEntity || {
                id: ed.source_entity_id,
                scope_key: ed.scope_key,
                name: ed.source_entity_id,
                summary: '',
                tag: [],
                is_speaker: false,
                user_id: null,
                created_at: '',
                updated_at: '',
              },
              target_entity: targetEntity || {
                id: ed.target_entity_id,
                scope_key: ed.scope_key,
                name: ed.target_entity_id,
                summary: '',
                tag: [],
                is_speaker: false,
                user_id: null,
                created_at: '',
                updated_at: '',
              },
            });
          } else setDialogOpen(false);
          break;
        }
        case 'thread': {
          const th = threads.find((t) => t.id === id);
          if (th)
            setSelectedThreadDetail({
              ...th,
              milestones: [],
              episodes: [],
              entities: [],
            });
          else setDialogOpen(false);
          break;
        }
      }
    }
  };

  const edgeSlices: RatioSlice[] = useMemo(() => {
    if (!stats) return [];
    const counts = stats.edge_state_counts ?? {};
    const active = counts.active ?? stats.active_edge_count ?? 0;
    const staging = counts.staging ?? 0;
    const superseded = counts.superseded ?? 0;
    const contradicted = counts.contradicted ?? 0;
    const retracted = counts.retracted ?? 0;
    const classifiedTotal = active + staging + superseded + contradicted + retracted;
    const inactiveOrHistorical = Math.max(0, stats.edge_count - classifiedTotal);

    const slices: RatioSlice[] = [];
    if (active > 0) {
      slices.push({
        label: t('aiMemory.edgeState_active'),
        value: active,
        text: active.toLocaleString(),
        color: '#10b981',
      });
    }
    if (staging > 0) {
      slices.push({
        label: t('aiMemory.edgeState_staging'),
        value: staging,
        text: staging.toLocaleString(),
        color: '#f59e0b',
      });
    }
    if (superseded > 0) {
      slices.push({
        label: t('aiMemory.edgeState_superseded'),
        value: superseded,
        text: superseded.toLocaleString(),
        color: '#64748b',
      });
    }
    if (contradicted > 0) {
      slices.push({
        label: t('aiMemory.edgeState_contradicted'),
        value: contradicted,
        text: contradicted.toLocaleString(),
        color: '#f43f5e',
      });
    }
    if (retracted > 0) {
      slices.push({
        label: t('aiMemory.edgeState_retracted'),
        value: retracted,
        text: retracted.toLocaleString(),
        color: '#a855f7',
      });
    }
    if (inactiveOrHistorical > 0) {
      slices.push({
        label: t('aiMemory.edgeState_inactive'),
        value: inactiveOrHistorical,
        text: inactiveOrHistorical.toLocaleString(),
        color: '#94a3b8',
      });
    }
    return slices;
  }, [stats, t]);

  const entitySlices: RatioSlice[] = useMemo(() => {
    if (!stats) return [];
    const speakers = stats.speaker_entity_count ?? 0;
    const others = Math.max(0, stats.entity_count - speakers);
    return [
      {
        label: t('aiMemory.statsSpeakers'),
        value: speakers,
        text: speakers.toLocaleString(),
        color: '#6366f1',
      },
      {
        label: t('aiMemory.legendEntity'),
        value: others,
        text: others.toLocaleString(),
        color: '#06b6d4',
      },
    ];
  }, [stats, t]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PinnedPage
      header={
        /* Header */
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Brain className="w-8 h-8" />
              {t('aiMemory.title')}
            </h1>
            <p className="text-muted-foreground mt-1">{t('aiMemory.description')}</p>
          </div>
          <div className={headerActionRowClass}>
            <Button
              variant="outline"
              className={cn(tabToolbarControlClass, 'w-full sm:w-auto sm:shrink-0')}
              disabled={isReconciling || !selectedScope || selectedScope === 'all'}
              title={selectedScope === 'all' ? t('aiMemory.allScopes') : t('aiMemory.reconcile')}
              onClick={handleReconcileIndex}
            >
              <Zap className={cn('w-4 h-4', isReconciling && 'animate-spin')} />
              {t('aiMemory.reconcile')}
            </Button>
            <Button
              variant="outline"
              className={cn(tabToolbarControlClass, 'w-full sm:w-auto sm:shrink-0')}
              onClick={() => setMigrationDialogOpen(true)}
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              {t('aiMemory.migrationReport')}
            </Button>
            <Button
              variant="outline"
              className={cn(tabToolbarControlClass, 'w-full sm:w-auto sm:shrink-0')}
              asChild
            >
              <Link to="/ai-debug?tab=cognition">
                <Globe className="w-4 h-4" />
                {t('aiMemory.cognitionIndexLink')}
              </Link>
            </Button>
            <Button
              variant="outline"
              className={cn(
                tabToolbarControlClass,
                'w-full sm:w-auto sm:shrink-0',
                activeTab === 'debug' && 'bg-primary/20 text-primary border-primary/50 font-medium',
              )}
              onClick={() => setActiveTab('debug')}
            >
              <AlertCircle className="w-4 h-4" />
              调试视图
            </Button>
            <Button
              variant="outline"
              className={cn(tabToolbarControlClass, 'w-full sm:w-auto sm:shrink-0')}
              onClick={() => setMemorySettingsOpen(true)}
            >
              <Brain className="w-4 h-4" />
              {t('memorySettings.title')}
            </Button>
          </div>
        </div>
      }
    >
      <MemorySettingsDialog
        open={memorySettingsOpen}
        onOpenChange={setMemorySettingsOpen}
        scopeKey={
          selectedScope && selectedScope !== 'all'
            ? selectedScope
            : (scopes[0]?.scope_key ?? undefined)
        }
        onAfterSave={() => {
          setMemorySettingsVersion((v) => v + 1);
          void memoryApi
            .getConfig()
            .then((cfgData) => {
              if (cfgData) setConfig(cfgData);
            })
            .catch(() => {});
        }}
      />
      {error && (
        <GlassAlert tone="danger" icon={AlertCircle}>
          {error}
        </GlassAlert>
      )}

      {/* Dashboard Metrics：对称三列 4+4+4 排布，承载全局核心指标与视图切换 */}
      {stats && (
        <div className="grid grid-cols-1 gap-3 md:gap-2.5 md:grid-cols-12">
          {/* Card 1: 记忆边与事实 (4列，主体切换至边列表，右上角含偏好统计与图谱入口) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('edges')}
            className="md:col-span-6 xl:col-span-4 cursor-pointer group"
          >
            <MetricHero
              className={cn(
                'h-full transition-all duration-200 hover:border-border/80',
                activeTab === 'edges' &&
                  'ring-1 ring-primary/40 border-primary/50 shadow-sm bg-primary/[0.02]',
              )}
              title={t('aiMemory.statsEdges')}
              value={stats.edge_count.toLocaleString()}
              desc={`${stats.active_edge_count.toLocaleString()} ${t('aiMemory.edgeState_active')} · ${(
                (stats.active_edge_count / Math.max(stats.edge_count, 1)) * 100
              ).toFixed(1)}% ${t('aiMemory.activeRatio')}`}
              icon={GitBranch}
              extra={
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md bg-muted/20 hover:bg-muted/40 border border-border/30 transition-all',
                      activeTab === 'preferences' &&
                        'bg-indigo-500/15 text-indigo-400 border-indigo-500/30 font-medium',
                    )}
                    onClick={() => setActiveTab('preferences')}
                  >
                    <ListChecks className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('aiMemory.tabPreferences')}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {totalPreferences}
                    </span>
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md bg-muted/20 hover:bg-muted/40 border border-border/30 transition-all',
                      activeTab === 'graph' &&
                        'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-medium',
                    )}
                    onClick={() => setActiveTab('graph')}
                  >
                    <Network className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{t('aiMemory.tabGraph')}</span>
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </Button>
                </div>
              }
            >
              <RatioBar slices={edgeSlices} total={stats.edge_count} />
            </MetricHero>
          </div>

          {/* Card 2: 记忆实体与发言人 (4列，主体切换至实体列表，右上角含世界枢纽统计与入口) */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setActiveTab('entities')}
            className="md:col-span-6 xl:col-span-4 cursor-pointer group"
          >
            <MetricHero
              className={cn(
                'h-full transition-all duration-200 hover:border-border/80',
                activeTab === 'entities' &&
                  'ring-1 ring-primary/40 border-primary/50 shadow-sm bg-primary/[0.02]',
              )}
              title={t('aiMemory.statsEntities')}
              value={stats.entity_count.toLocaleString()}
              desc={`${stats.speaker_entity_count.toLocaleString()} ${t('aiMemory.statsSpeakers')} · ${(
                (stats.speaker_entity_count / Math.max(stats.entity_count, 1)) * 100
              ).toFixed(1)}% ${t('aiMemory.speakerRatio')}`}
              icon={Brain}
              extra={
                <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      'h-6 shrink-0 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground rounded-md bg-muted/20 hover:bg-muted/40 border border-border/30 transition-all',
                      activeTab === 'world' &&
                        'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 font-medium',
                    )}
                    onClick={() => setActiveTab('world')}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{t('aiMemory.tabWorld')}</span>
                    <span className="font-semibold tabular-nums text-foreground">
                      {worldHubs.length}
                    </span>
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </Button>
                </div>
              }
            >
              <RatioBar slices={entitySlices} total={stats.entity_count} />
            </MetricHero>
          </div>

          {/* Card 3: 运行与流转概览 (2x2 紧凑四格，无多余头部，削减空白) (4列) */}
          <div className="md:col-span-12 xl:col-span-4">
            <Card className="glass-card flex flex-col h-full">
              <CardContent className="flex-1 p-3 sm:p-3.5 flex flex-col justify-center">
                <div className="grid grid-cols-2 gap-2 h-full">
                  {/* Item 1: 对话片段 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('episodes')}
                    className={cn(
                      'flex flex-col justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer border border-border/30',
                      activeTab === 'episodes' &&
                        'border-primary/50 bg-primary/10 shadow-sm font-medium',
                    )}
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[11px] font-medium flex items-center gap-1">
                        <MessageSquare className="w-3.5 h-3.5 text-primary" />
                        {t('aiMemory.statsEpisodes')}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums leading-none">
                      {stats.episode_count.toLocaleString()}
                    </p>
                  </div>

                  {/* Item 2: 故事线 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('threads')}
                    className={cn(
                      'flex flex-col justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer border border-border/30',
                      activeTab === 'threads' &&
                        'border-indigo-500/50 bg-indigo-500/10 shadow-sm font-medium',
                    )}
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[11px] font-medium flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        {t('aiMemory.statsThreads')}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums leading-none">
                      {(stats.thread_count ?? 0).toLocaleString()}
                    </p>
                  </div>

                  {/* Item 3: 记忆范围 */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setActiveTab('scopes')}
                    className={cn(
                      'flex flex-col justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer border border-border/30',
                      activeTab === 'scopes' &&
                        'border-cyan-500/50 bg-cyan-500/10 shadow-sm font-medium',
                    )}
                  >
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[11px] font-medium flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        {t('aiMemory.statsScopes')}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums leading-none">
                      {stats.scope_keys.length.toLocaleString()}
                    </p>
                  </div>

                  {/* Item 4: 摄入队列 */}
                  <div className="flex flex-col justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="text-[11px] font-medium flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        {t('aiMemory.statsQueue')}
                      </span>
                      <span
                        className={cn(
                          'w-2 h-2 rounded-full',
                          stats.observation_queue_size === 0
                            ? 'bg-emerald-500'
                            : 'bg-amber-500 animate-pulse',
                        )}
                      />
                    </div>
                    <p className="mt-1 text-lg font-bold tabular-nums leading-none">
                      {stats.observation_queue_size.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Group Summary Cache */}
      {hierGraphStatus?.group_summary_cache && (
        <Card className={cn('glass-card')}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{t('aiMemory.groupSummary')}</p>
            <p className="mt-1 text-sm bg-muted/50 rounded p-2">
              {hierGraphStatus.group_summary_cache}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Knowledge Graph Tab */}
      {activeTab === 'graph' && (
        <div className={pageStackClass}>
          {entities.length === 0 && edges.length === 0 ? (
            <Card className={cn('glass-card')}>
              <div className="p-3 border-b border-border/30 flex flex-wrap items-center gap-3">
                <ScopeSelector
                  value={selectedScope || 'all'}
                  onChange={handleScopeChange}
                  scopes={scopes}
                  allLabel={t('aiMemory.allScopes')}
                  className={cn(tabToolbarControlClass, 'w-[200px] sm:w-[240px]')}
                />
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium">{t('aiMemory.tabGraph')}</span>
                </div>
              </div>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                {isLoadingGraph ? (
                  <>
                    <Loader2 className="w-12 h-12 mb-4 animate-spin text-primary" />
                    <p>{t('common.loading')}</p>
                  </>
                ) : (
                  <>
                    <Network className="w-12 h-12 mb-4 opacity-50" />
                    <p>{t('aiMemory.noGraphData')}</p>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <KnowledgeGraph
              entities={entities}
              edges={edges}
              isGlass={isGlass}
              isDark={isDark}
              onNodeClick={(type, id) => openDetailDialog(type, id)}
              selectedScope={selectedScope}
              onScopeChange={handleScopeChange}
              scopes={scopes}
              onClearMemory={() => setClearMemoryDialogOpen(true)}
              onRefresh={() => {
                loadedTabDataRef.current.delete(`graph:${selectedScope}`);
                loadedTabDataRef.current.delete(`entities:${selectedScope}`);
                loadedTabDataRef.current.delete(`edges:${selectedScope}`);
                loadedTabDataRef.current.delete(`world:${selectedScope}`);
                void loadTabData('graph', selectedScope);
              }}
            />
          )}
        </div>
      )}

      {activeTab === 'world' && (
        <div className={pageStackClass}>
          {worldHubs.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <Globe className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noWorldHubs')}</p>
              </CardContent>
            </Card>
          ) : (
            <WorldHubGraph
              hubs={worldHubs}
              isDark={isDark}
              onHubClick={(hub) => openDetailDialog('world', worldGraphId(hub))}
              onArticleClick={setPreviewArticle}
              onRefresh={() => fetchCognition()}
            />
          )}
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('aiMemory.preferenceCount', {
                count: preferences.length,
                total: totalPreferences,
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={preferenceSearch}
                  onChange={(e) => setPreferenceSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setPreferencePage(1);
                      void fetchPreferences(1);
                    }
                  }}
                  placeholder="搜索偏好 / 用户ID..."
                  className={cn(tabToolbarControlClass, 'pl-8 pr-7')}
                />
                {preferenceSearch && (
                  <button
                    onClick={() => {
                      setPreferenceSearch('');
                      setPreferencePage(1);
                      void fetchPreferences(1, selectedScope, { keyword: '' });
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.preferenceScopeAll')}
                className={cn(tabToolbarControlClass, 'w-[240px]')}
              />
              <Select
                value={preferenceFilter}
                onValueChange={(v) => {
                  const next = v as typeof preferenceFilter;
                  setPreferenceFilter(next);
                  setPreferencePage(1);
                  void fetchPreferences(1, selectedScope, { filter: next });
                }}
              >
                <SelectTrigger className={cn(tabToolbarControlClass, 'w-28')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.preferenceFilterAll')}</SelectItem>
                  <SelectItem value="active">{t('aiMemory.preferenceFilterActive')}</SelectItem>
                  <SelectItem value="inactive">{t('aiMemory.preferenceFilterInactive')}</SelectItem>
                  <SelectItem value="correction">
                    {t('aiMemory.preferenceFilterCorrection')}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={preferencePolarityFilter}
                onValueChange={(v) => {
                  const next = v as typeof preferencePolarityFilter;
                  setPreferencePolarityFilter(next);
                  setPreferencePage(1);
                  void fetchPreferences(1, selectedScope, { polarity: next });
                }}
              >
                <SelectTrigger className={cn(tabToolbarControlClass, 'w-28')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.preferenceFilterAll')}</SelectItem>
                  <SelectItem value="do">{t('aiMemory.preferenceFilterDo')}</SelectItem>
                  <SelectItem value="dont">{t('aiMemory.preferenceFilterDont')}</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className={tabToolbarControlClass}
                onClick={() => fetchPreferences(preferencePage)}
              >
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
          </div>

          {isLoadingPreferences ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : preferences.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <ListChecks className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noPreferences')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {preferences.map((pref) => {
                const isEditing = editingPreference?.id === pref.id;
                const draft = isEditing ? editingPreferenceDraft : null;
                const ruleText = draft?.preference_rule ?? pref.preference_rule;
                const polarity = draft?.polarity ?? pref.polarity;
                const _ctx = draft?.target_context ?? pref.target_context;
                const _active = draft?.is_active ?? pref.is_active;
                return (
                  <Card
                    key={pref.id}
                    className={cn('transition-all', 'glass-card', !pref.is_active && 'opacity-70')}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <Badge variant={pref.is_correction ? 'default' : 'secondary'}>
                            {pref.is_correction
                              ? t('aiMemory.preferenceCorrection')
                              : polarity === 'do'
                                ? t('aiMemory.preferencePolarityDo')
                                : t('aiMemory.preferencePolarityDont')}
                          </Badge>
                          <Badge variant={pref.is_active ? 'outline' : 'destructive'}>
                            {pref.is_active
                              ? t('aiMemory.preferenceActive')
                              : t('aiMemory.preferenceInactive')}
                          </Badge>
                          <Badge variant="outline" className="font-mono text-xs">
                            {pref.target_context}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground truncate">
                            {pref.id}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => togglePreferenceActive(pref)}
                            title={
                              pref.is_active
                                ? t('aiMemory.preferenceDisable')
                                : t('aiMemory.preferenceEnable')
                            }
                          >
                            <Power
                              className={cn(
                                'w-4 h-4',
                                pref.is_active ? 'text-amber-500' : 'text-emerald-500',
                              )}
                            />
                          </Button>
                          {isEditing ? (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="button-solid"
                                disabled={savingPreference}
                                onClick={saveEditPreference}
                              >
                                {savingPreference ? (
                                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                ) : (
                                  <Save className="w-4 h-4 mr-1" />
                                )}
                                {t('common.save')}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={savingPreference}
                                onClick={cancelEditPreference}
                              >
                                <X className="w-4 h-4 mr-1" />
                                {t('common.cancel')}
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditPreference(pref)}
                              title={t('aiMemory.preferenceEdit')}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingPreference(pref)}
                            title={t('common.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      {isEditing && draft ? (
                        <div className="space-y-3 rounded-md border border-border/50 p-3 bg-muted/30">
                          <div className="space-y-1">
                            <Label>{t('aiMemory.preferenceRule')}</Label>
                            <Textarea
                              value={draft.preference_rule}
                              onChange={(e) =>
                                setEditingPreferenceDraft({
                                  ...draft,
                                  preference_rule: e.target.value,
                                })
                              }
                              placeholder={t('aiMemory.preferenceRulePlaceholder')}
                              rows={3}
                              maxLength={2000}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label>{t('aiMemory.preferencePolarity')}</Label>
                              <Select
                                value={draft.polarity}
                                onValueChange={(v) =>
                                  setEditingPreferenceDraft({
                                    ...draft,
                                    polarity: v as 'do' | 'dont',
                                  })
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="do">
                                    {t('aiMemory.preferencePolarityDo')}
                                  </SelectItem>
                                  <SelectItem value="dont">
                                    {t('aiMemory.preferencePolarityDont')}
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>{t('aiMemory.preferenceContext')}</Label>
                              <Input
                                value={draft.target_context}
                                onChange={(e) =>
                                  setEditingPreferenceDraft({
                                    ...draft,
                                    target_context: e.target.value,
                                  })
                                }
                                placeholder={t('aiMemory.preferenceContextPlaceholder')}
                                maxLength={128}
                              />
                              <p className="text-xs text-muted-foreground">
                                {t('aiMemory.preferenceContextHelp')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                            <div>
                              <Label className="text-sm">{t('aiMemory.preferenceIsActive')}</Label>
                            </div>
                            <Switch
                              checked={draft.is_active}
                              onCheckedChange={(v) =>
                                setEditingPreferenceDraft({ ...draft, is_active: v })
                              }
                            />
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap break-words">{ruleText}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {pref.user_id}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="w-3 h-3" />
                          {pref.scope_key}
                        </span>
                        <span className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {t('aiMemory.preferenceMentionCount')}: {pref.mention_count}
                        </span>
                        {pref.source_episode_id && (
                          <span
                            className="flex items-center gap-1 font-mono truncate max-w-[200px]"
                            title={pref.source_episode_id}
                          >
                            <GitBranch className="w-3 h-3" />
                            {pref.source_episode_id}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('aiMemory.updatedAt')}: {formatDate(pref.updated_at)}
                        </span>
                        {pref.last_applied_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('aiMemory.preferenceLastApplied')}:{' '}
                            {formatDate(pref.last_applied_at)}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {totalPreferences > 20 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={preferencePage <= 1}
                onClick={() => fetchPreferences(preferencePage - 1)}
              >
                {t('common.previousPage')}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {preferencePage} / {Math.ceil(totalPreferences / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={preferencePage >= Math.ceil(totalPreferences / 20)}
                onClick={() => fetchPreferences(preferencePage + 1)}
              >
                {t('common.nextPage')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Scopes Tab */}
      {activeTab === 'scopes' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('aiMemory.scopeCount', { count: scopes.length })}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const data = await memoryApi.getScopes();
                setScopes(sanitizeScopes(data));
              }}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              {t('common.refresh')}
            </Button>
          </div>
          <div
            className={cn(
              'glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
              pageGapClass,
            )}
          >
            {scopes.map((scope) => (
              <ScopeCard
                key={scope.scope_key}
                scope={scope}
                onDelete={() => handleDeleteScope(scope.scope_key)}
                onOpen={(tab) => handleOpenScope(scope.scope_key, tab)}
              />
            ))}
          </div>
          {scopes.length === 0 && (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <Network className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noScopes')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Episodes Tab */}
      {activeTab === 'episodes' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('aiMemory.episodeCount', { count: episodes.length, total: totalEpisodes })}
            </p>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={() => fetchEpisodes(episodePage)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
          </div>
          {isLoadingData ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noEpisodes')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <Card
                  key={episode.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
                    'glass-card',
                  )}
                  onClick={() => openDetailDialog('episode', episode.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 md:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-3">{truncateText(episode.content, 200)}</p>
                        <div className="flex items-center gap-3 md:gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {episode.speaker_ids.length} {t('aiMemory.speakers')}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(episode.valid_at)}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEpisode(episode.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {totalEpisodes > 20 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={episodePage <= 1}
                onClick={() => fetchEpisodes(episodePage - 1)}
              >
                {t('common.previousPage')}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {episodePage} / {Math.ceil(totalEpisodes / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={episodePage >= Math.ceil(totalEpisodes / 20)}
                onClick={() => fetchEpisodes(episodePage + 1)}
              >
                {t('common.nextPage')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Entities Tab */}
      {activeTab === 'entities' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Input
                placeholder={t('aiMemory.searchEntities')}
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    loadedTabDataRef.current.delete(`graph:${selectedScope}`);
                    void fetchEntities(1, selectedScope, { search: entitySearch });
                  }
                }}
                className="max-w-xs"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  loadedTabDataRef.current.delete(`graph:${selectedScope}`);
                  void fetchEntities(1, selectedScope, { search: entitySearch });
                }}
              >
                {t('common.search')}
              </Button>
            </div>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next =
                    entityFilterSpeaker === undefined
                      ? true
                      : entityFilterSpeaker === true
                        ? false
                        : undefined;
                  setEntityFilterSpeaker(next);
                  loadedTabDataRef.current.delete(`graph:${selectedScope}`);
                  void fetchEntities(1, selectedScope, { isSpeaker: next ?? null });
                }}
              >
                <Users className="w-4 h-4 mr-1" />
                {entityFilterSpeaker === true
                  ? t('aiMemory.speakersOnly')
                  : entityFilterSpeaker === false
                    ? t('aiMemory.nonSpeakersOnly')
                    : t('aiMemory.allUsers')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchEntities(entityPage)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('aiMemory.entityCount', {
              count: Math.min(20, Math.max(0, entities.length - (entityPage - 1) * 20)),
              total: totalEntities,
            })}
          </p>
          {isLoadingData ? (
            <div
              className={cn(
                'glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                pageGapClass,
              )}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : entities.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <Brain className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noEntities')}</p>
              </CardContent>
            </Card>
          ) : (
            <div
              className={cn(
                'glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
                pageGapClass,
              )}
            >
              {entities.slice((entityPage - 1) * 20, entityPage * 20).map((entity) => (
                <div key={entity.id} className="group">
                  <EntityNode
                    entity={entity}
                    isGlass={isGlass}
                    worldHub={hubForEntity(entity.id, entity.name, cognitionNodes)}
                    onClick={() => openDetailDialog('entity', entity.id)}
                    onDelete={() => handleDeleteEntity(entity.id)}
                  />
                </div>
              ))}
            </div>
          )}
          {entities.length > 20 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={entityPage <= 1}
                onClick={() => setEntityPage((p) => Math.max(1, p - 1))}
              >
                {t('common.previousPage')}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {entityPage} / {Math.ceil(entities.length / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={entityPage >= Math.ceil(entities.length / 20)}
                onClick={() =>
                  setEntityPage((p) => Math.min(Math.ceil(entities.length / 20), p + 1))
                }
              >
                {t('common.nextPage')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Edges Tab */}
      {activeTab === 'edges' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t('aiMemory.edgeCount', {
                count: Math.min(20, Math.max(0, edges.length - (edgePage - 1) * 20)),
                total: totalEdges,
              })}
            </p>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                <Switch
                  checked={includeEdgeHistory}
                  onCheckedChange={(checked) => {
                    setIncludeEdgeHistory(checked);
                    loadedTabDataRef.current.delete(`graph:${selectedScope}`);
                    void fetchEdges(1, selectedScope, { includeHistory: checked });
                  }}
                />
                {t('aiMemory.showEdgeHistory')}
              </label>
              <Button variant="outline" size="sm" onClick={() => fetchEdges(edgePage)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
          </div>
          {isLoadingData ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : edges.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <GitBranch className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noEdges')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {edges.slice((edgePage - 1) * 20, edgePage * 20).map((edge) => (
                <div key={edge.id} className="relative group">
                  <EdgeItem
                    edge={edge}
                    isGlass={isGlass}
                    onClick={() => openDetailDialog('edge', edge.id)}
                    sourceName={entities.find((e) => e.id === edge.source_entity_id)?.name}
                    targetName={entities.find((e) => e.id === edge.target_entity_id)?.name}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteEdge(edge.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {edges.length > 20 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={edgePage <= 1}
                onClick={() => setEdgePage((p) => Math.max(1, p - 1))}
              >
                {t('common.previousPage')}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {edgePage} / {Math.ceil(edges.length / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={edgePage >= Math.ceil(edges.length / 20)}
                onClick={() => setEdgePage((p) => Math.min(Math.ceil(edges.length / 20), p + 1))}
              >
                {t('common.nextPage')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Threads Tab */}
      {activeTab === 'threads' && (
        <div className={pageStackClass}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {t('aiMemory.threadCount', { count: threads.length, total: totalThreads })}
              </p>
              {selectedParticipantUid && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  {t('aiMemory.filterByParticipant')}:{' '}
                  {selectedParticipantName || selectedParticipantUid}
                  <button
                    type="button"
                    className="ml-1 hover:text-foreground"
                    title={t('aiMemory.clearParticipantFilter')}
                    onClick={() => {
                      setSelectedParticipantUid('');
                      setSelectedParticipantName('');
                      void fetchThreads(1, selectedScope, { participantUid: '' });
                    }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
                <Switch
                  checked={showArchivedThreads}
                  onCheckedChange={(checked) => {
                    setShowArchivedThreads(checked);
                    void fetchThreads(1, selectedScope, { includeArchived: checked });
                  }}
                />
                {t('aiMemory.showArchivedThreads')}
              </label>
              <Button variant="outline" size="sm" onClick={() => fetchThreads(threadPage)}>
                <RefreshCw className="w-4 h-4 mr-1" />
                {t('common.refresh')}
              </Button>
            </div>
          </div>
          {isLoadingThreads ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : threads.length === 0 ? (
            <Card className={cn('glass-card')}>
              <CardContent className="flex flex-col items-center justify-center !p-8 text-center text-muted-foreground">
                <Layers className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noThreads')}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {threads.map((thread) => {
                const participants = thread.participants ?? [];
                const statusKey =
                  thread.status === 'active' ||
                  thread.status === 'dormant' ||
                  thread.status === 'archived'
                    ? `aiMemory.threadStatus_${thread.status}`
                    : '';
                return (
                  <Card
                    key={thread.id}
                    className={cn(
                      'glass-card cursor-pointer transition-all hover:border-primary/50',
                      thread.status === 'archived' && 'opacity-70',
                    )}
                    onClick={() => openDetailDialog('thread', thread.id)}
                  >
                    <CardContent className="p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium truncate">{thread.title || thread.id}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-xs">
                            {t('aiMemory.milestones')} {thread.milestone_count}
                          </Badge>
                          {(thread.episode_count ?? 0) > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {t('aiMemory.threadEpisodesCount')} {thread.episode_count}
                            </Badge>
                          )}
                          <Badge
                            variant={thread.status === 'active' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {statusKey ? t(statusKey) : thread.status}
                          </Badge>
                        </div>
                      </div>
                      {thread.summary && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {thread.summary}
                        </p>
                      )}
                      {participants.length > 0 && (
                        <div
                          className="flex flex-wrap items-center gap-1.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {participants.slice(0, 8).map((p) => {
                            const isSelected = selectedParticipantUid === p.user_id;
                            return (
                              <button
                                key={p.user_id}
                                type="button"
                                title={`${p.name} (${p.user_id})`}
                                onClick={() => {
                                  const nextUid = isSelected ? '' : p.user_id;
                                  const nextName = isSelected ? '' : p.name;
                                  setSelectedParticipantUid(nextUid);
                                  setSelectedParticipantName(nextName);
                                  void fetchThreads(1, selectedScope, { participantUid: nextUid });
                                }}
                                className={cn(
                                  'inline-flex items-center gap-1.5 rounded-full border pl-0.5 pr-2 py-0.5 text-xs transition-colors hover:bg-accent/60',
                                  isSelected
                                    ? 'border-primary bg-primary/15 text-primary'
                                    : 'border-border/50 bg-muted/30 text-muted-foreground',
                                )}
                              >
                                <ParticipantAvatar
                                  name={p.name || p.user_id}
                                  avatarUrl={p.avatar_url}
                                />
                                <span className="max-w-[96px] truncate">{p.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {thread.aliases.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {thread.aliases.map((alias) => (
                            <Badge key={alias} variant="outline" className="text-xs">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {t('aiMemory.lastActive')}: {formatDate(thread.last_at ?? '')}
                        </span>
                        <span className="font-mono truncate">{thread.scope_key}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {totalThreads > 20 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={threadPage <= 1}
                onClick={() => fetchThreads(threadPage - 1)}
              >
                {t('common.previousPage')}
              </Button>
              <span className="flex items-center text-sm text-muted-foreground">
                {threadPage} / {Math.ceil(totalThreads / 20)}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={threadPage >= Math.ceil(totalThreads / 20)}
                onClick={() => fetchThreads(threadPage + 1)}
              >
                {t('common.nextPage')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Agent Debug Tab */}
      {activeTab === 'debug' && (
        <div className={pageStackClass}>
          <Card className={cn('glass-card')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-primary" />
                Memory Graph Debug
              </CardTitle>
              <CardDescription>
                使用 Agent Debug API 查看指定 scope 的 Edge 与矛盾记录，并可软删除错误 Edge。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-2">
                  <Label>Scope Key</Label>
                  <ScopeSelector
                    value={selectedScope}
                    onChange={handleScopeChange}
                    scopes={scopes}
                    allLabel="请选择具体范围"
                    className="w-[260px]"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 rounded-md border border-border/50 px-3 py-2">
                    <Switch
                      checked={includeInvalidEdges}
                      onCheckedChange={setIncludeInvalidEdges}
                    />
                    <Label className="text-sm">包含已失效 Edge</Label>
                  </div>
                  <Button
                    onClick={() => fetchDebugMemory()}
                    disabled={selectedScope === 'all' || isLoadingDebug}
                  >
                    {isLoadingDebug ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-2" />
                    )}
                    查询调试数据
                  </Button>
                </div>
              </div>
              {selectedScope === 'all' && (
                <GlassAlert tone="warning">
                  Agent Debug 接口要求指定明确 scope_key，请先选择如 group:789012 的范围。
                </GlassAlert>
              )}
            </CardContent>
          </Card>

          <div className={cn('grid grid-cols-1 xl:grid-cols-3', pageGapClass)}>
            <Card className={cn('xl:col-span-2', 'glass-card')}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>Edge 列表</span>
                  <Badge variant="outline">{debugEdges.length}</Badge>
                </CardTitle>
                <CardDescription>仅软删除 Edge，不会物理删除数据库记录。</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDebug ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : debugEdges.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">暂无 Edge 数据</div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                    {debugEdges.map((edge) => (
                      <div
                        key={edge.id}
                        className={cn(
                          'rounded-lg border border-border/50 p-4',
                          edge.invalid_at && 'opacity-60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={edge.invalid_at ? 'destructive' : 'default'}>
                                {edge.invalid_at ? '已失效' : '有效'}
                              </Badge>
                              <span className="font-mono text-xs text-muted-foreground">
                                {edge.id}
                              </span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{edge.fact}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>源: {edge.source_entity_id}</span>
                              <span>目标: {edge.target_entity_id}</span>
                              <span>提及: {edge.mention_count ?? 0}</span>
                              <span>
                                评分:{' '}
                                {typeof edge.decay_score === 'number'
                                  ? edge.decay_score.toFixed(3)
                                  : '-'}
                              </span>
                              <span>
                                最近访问:{' '}
                                {edge.last_accessed ? formatDate(edge.last_accessed) : '-'}
                              </span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={!!edge.invalid_at}
                            onClick={() => requestInvalidateEdge(edge)}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            失效
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cn('glass-card')}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>记忆矛盾</span>
                  <Badge variant="outline">{debugConflicts.length}</Badge>
                </CardTitle>
                <CardDescription>用于辅助定位冲突事实。</CardDescription>
              </CardHeader>
              <CardContent>
                {debugConflicts.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">暂无矛盾记录</div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                    {debugConflicts.map((conflict) => (
                      <div
                        key={conflict.id}
                        className="rounded-lg border border-border/50 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">{conflict.fact_signature}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {conflict.created_at ? formatDate(conflict.created_at) : '-'}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {conflict.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 检索试跑（原独立页签，并入调试视图） */}
          <MemorySearchPanel />
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className={pageStackClass}>
          {config && (
            <>
              <Card className={cn('glass-card')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    {t('aiMemory.observerSettings')}
                  </CardTitle>
                  <CardDescription>{t('aiMemory.observerSettingsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>{t('aiMemory.observerEnabled')}</Label>
                      <p className="text-sm text-muted-foreground">
                        {t('aiMemory.observerEnabledDesc')}
                      </p>
                    </div>
                    <Switch checked={config.observer_enabled} disabled />
                  </div>
                  {config.observer_blacklist.length > 0 && (
                    <div>
                      <Label>{t('aiMemory.observerBlacklist')}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {config.observer_blacklist.map((id) => (
                          <Badge key={id} variant="outline">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className={cn('glass-card')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    {t('aiMemory.ingestionSettings')}
                  </CardTitle>
                  <CardDescription>{t('aiMemory.ingestionSettingsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div>
                      <Label className="text-muted-foreground">
                        {t('aiMemory.ingestionEnabled')}
                      </Label>
                      <p className="font-semibold">
                        {config.ingestion_enabled ? t('common.enabled') : t('common.disabled')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">{t('aiMemory.llmSemaphore')}</Label>
                      <p className="font-semibold">{config.llm_semaphore_limit}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('memorySettings.fields.windowMaxMessages')}
                      </Label>
                      <p className="font-semibold">{config.window_max_messages ?? 50}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('memorySettings.fields.windowIdleSeconds')}
                      </Label>
                      <p className="font-semibold">{config.window_idle_seconds ?? 480}s</p>
                    </div>
                  </div>
                  {(config.external_bot_ids?.length ?? 0) > 0 && (
                    <div>
                      <Label>{t('memorySettings.fields.externalBotIds')}</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(config.external_bot_ids ?? []).map((id) => (
                          <Badge key={id} variant="outline" className="font-mono">
                            {id}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card className={cn('glass-card')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Search className="w-5 h-5" />
                    {t('aiMemory.retrievalSettings')}
                  </CardTitle>
                  <CardDescription>{t('aiMemory.retrievalSettingsDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 md:space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div>
                      <Label className="text-muted-foreground">
                        {t('aiMemory.enableRetrieval')}
                      </Label>
                      <p className="font-semibold">
                        {config.enable_retrieval ? t('common.enabled') : t('common.disabled')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('aiMemory.enableUserGlobalMemory')}
                      </Label>
                      <p className="font-semibold">
                        {config.enable_user_global_memory
                          ? t('common.enabled')
                          : t('common.disabled')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('aiMemory.enableHeartbeatMemory')}
                      </Label>
                      <p className="font-semibold">
                        {config.enable_heartbeat_memory
                          ? t('common.enabled')
                          : t('common.disabled')}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('memorySettings.fields.enablePreferenceMemory')}
                      </Label>
                      <p className="font-semibold">
                        {config.enable_preference_memory
                          ? t('common.enabled')
                          : t('common.disabled')}
                      </p>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div>
                      <Label className="text-muted-foreground">{t('aiMemory.retrievalTopK')}</Label>
                      <p className="font-semibold">{config.retrieval_top_k}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('aiMemory.dedupThreshold')}
                      </Label>
                      <p className="font-semibold">
                        {(config.dedup_similarity_threshold * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('memorySettings.fields.memoryInjectMaxChars')}
                      </Label>
                      <p className="font-semibold">{config.memory_inject_max_chars ?? 8000}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">
                        {t('memorySettings.fields.sessionGapSeconds')}
                      </Label>
                      <p className="font-semibold">{config.session_gap_seconds ?? 1800}s</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      <CognitionArticlePreview article={previewArticle} onClose={() => setPreviewArticle(null)} />

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className={cn(
            'flex flex-col p-6',
            dialogType === 'entity' ? 'max-w-3xl max-h-[88vh]' : 'max-w-2xl max-h-[85vh]',
          )}
        >
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle>
              {dialogType === 'episode' && t('aiMemory.episodeDetail')}
              {dialogType === 'entity' && t('aiMemory.entityDetail')}
              {dialogType === 'edge' && t('aiMemory.edgeDetail')}
              {dialogType === 'thread' && t('aiMemory.threadDetail')}
              {dialogType === 'world' && t('aiMemory.worldHubDetail')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiMemory.detailAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-1 space-y-3 md:space-y-4">
            {dialogType === 'episode' && selectedEpisode && (
              <div className="space-y-3 md:space-y-4">
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label>
                  <p className="font-mono text-sm">{selectedEpisode.scope_key}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.content')}</Label>
                  <p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                    {selectedEpisode.content}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.speakers')}</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedEpisode.speaker_ids.map((id) => (
                      <Badge key={id} variant="outline">
                        {id}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.validAt')}</Label>
                    <p>{formatDate(selectedEpisode.valid_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.createdAt')}</Label>
                    <p>{formatDate(selectedEpisode.created_at)}</p>
                  </div>
                </div>
                {selectedEpisode.mentioned_entities.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">
                      {t('aiMemory.mentionedEntities')}
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedEpisode.mentioned_entities.map((e) => (
                        <Badge
                          key={e.id}
                          variant="secondary"
                          className="cursor-pointer hover:bg-accent"
                          onClick={() => openDetailDialog('entity', e.id)}
                        >
                          {e.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {dialogType === 'entity' && selectedEntity && (
              <EntityCurationDrawer
                entity={selectedEntity}
                sameScopeEntities={entities}
                worldHub={hubForEntity(selectedEntity.id, selectedEntity.name, cognitionNodes)}
                formatDate={formatDate}
                onOpenEntity={(entityId) => openDetailDialog('entity', entityId)}
                onOpenWorldHub={(hub) => openDetailDialog('world', worldGraphId(hub))}
                onInvalidateEdge={(edge) => requestInvalidateEdge(edge)}
                onPatchEntity={handlePatchEntity}
                onMergeEntity={handleMergeEntity}
                onSplitEntity={handleSplitEntity}
              />
            )}
            {dialogType === 'edge' && selectedEdge && (
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      selectedEdge.resolution_state === 'contradicted'
                        ? 'destructive'
                        : (selectedEdge.resolution_state ?? 'active') === 'active'
                          ? 'default'
                          : 'outline'
                    }
                    className="text-xs"
                  >
                    {t(`aiMemory.edgeState_${selectedEdge.resolution_state || 'active'}`)}
                  </Badge>
                  {selectedEdge.edge_kind && (
                    <Badge variant="outline" className="text-xs">
                      {t(`aiMemory.edgeKind_${selectedEdge.edge_kind}`)}
                    </Badge>
                  )}
                  {selectedEdge.slot_key && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {selectedEdge.slot_key}
                    </Badge>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label>
                  <p className="font-mono text-sm">{selectedEdge.scope_key}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.fact')}</Label>
                  <p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                    {selectedEdge.fact}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.sourceEntity')}</Label>
                    <p className="font-medium">
                      {selectedEdge.source_entity?.name ?? selectedEdge.source_entity_id}
                    </p>
                    {selectedEdge.source_entity?.summary && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {truncateText(selectedEdge.source_entity.summary, 100)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.targetEntity')}</Label>
                    <p className="font-medium">
                      {selectedEdge.target_entity?.name ?? selectedEdge.target_entity_id}
                    </p>
                    {selectedEdge.target_entity?.summary && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {truncateText(selectedEdge.target_entity.summary, 100)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:gap-4 text-sm">
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.validAt')}</Label>
                    <p>{formatDate(selectedEdge.event_at || selectedEdge.valid_at)}</p>
                  </div>
                  {selectedEdge.invalid_at && (
                    <div>
                      <Label className="text-muted-foreground">{t('aiMemory.invalidAt')}</Label>
                      <p className="text-destructive">{formatDate(selectedEdge.invalid_at)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            {dialogType === 'world' && selectedWorldHub && (
              <div className="space-y-3 md:space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="gap-1">
                    <Globe className="w-3 h-3" />
                    {t('aiMemory.legendWorld')}
                  </Badge>
                  {selectedWorldHub.source && (
                    <Badge variant="outline">{selectedWorldHub.source}</Badge>
                  )}
                  {pluginFromWorldRef(selectedWorldHub.ref) && (
                    <Badge variant="secondary">{pluginFromWorldRef(selectedWorldHub.ref)}</Badge>
                  )}
                </div>
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.name')}</Label>
                  <p className="font-medium">{selectedWorldHub.title || selectedWorldHub.ref}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">ref</Label>
                  <p className="font-mono text-sm break-all">{selectedWorldHub.ref}</p>
                </div>
                {selectedWorldHub.summary && (
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.summary')}</Label>
                    <p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">
                      {selectedWorldHub.summary}
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t('aiMemory.scopeKey')}:{' '}
                    {selectedWorldHub.scope_key || t('aiMemory.publicWorldScope')}
                  </span>
                  {selectedWorldHub.as_of && <span>as_of={selectedWorldHub.as_of}</span>}
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">{t('aiMemory.attachedArticles')}</Label>
                  <CognitionAttachments
                    attachments={selectedWorldHub.attachments ?? []}
                    emptyText={t('aiMemory.noAttachments')}
                    openLabel={t('aiMemory.openArticle')}
                    writableLabel={t('aiMemory.articleWritable')}
                    readonlyLabel={t('aiMemory.articleReadonly')}
                  />
                </div>
              </div>
            )}
            {dialogType === 'thread' && selectedThreadDetail && (
              <div className="space-y-3 md:space-y-4">
                <div>
                  <Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label>
                  <p className="font-mono text-sm">{selectedThreadDetail.scope_key}</p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.title')}</Label>
                    <p className="font-medium text-base">
                      {selectedThreadDetail.title || selectedThreadDetail.id}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {t('aiMemory.milestones')}{' '}
                      {selectedThreadDetail.milestones?.length ??
                        selectedThreadDetail.milestone_count}
                    </Badge>
                    <Badge
                      variant={selectedThreadDetail.status === 'active' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {selectedThreadDetail.status === 'active' ||
                      selectedThreadDetail.status === 'dormant' ||
                      selectedThreadDetail.status === 'archived'
                        ? t(`aiMemory.threadStatus_${selectedThreadDetail.status}`)
                        : selectedThreadDetail.status}
                    </Badge>
                  </div>
                </div>
                {selectedThreadDetail.participants &&
                  selectedThreadDetail.participants.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedThreadDetail.participants.map((p) => (
                        <span
                          key={p.user_id}
                          title={`${p.name} (${p.user_id})`}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 pl-0.5 pr-2 py-0.5 text-xs text-muted-foreground"
                        >
                          <ParticipantAvatar name={p.name || p.user_id} avatarUrl={p.avatar_url} />
                          <span className="max-w-[110px] truncate">{p.name}</span>
                        </span>
                      ))}
                    </div>
                  )}
                {selectedThreadDetail.summary && (
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.summary')}</Label>
                    <p className="mt-1 p-2.5 bg-muted/50 rounded-md text-sm whitespace-pre-wrap">
                      {selectedThreadDetail.summary}
                    </p>
                  </div>
                )}
                {selectedThreadDetail.aliases && selectedThreadDetail.aliases.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.aliases')}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {selectedThreadDetail.aliases.map((alias) => (
                        <Badge key={alias} variant="outline" className="text-xs">
                          {alias}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.firstAt')}</Label>
                    <p className="font-mono text-xs">{formatDate(selectedThreadDetail.first_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.lastAt')}</Label>
                    <p className="font-mono text-xs">{formatDate(selectedThreadDetail.last_at)}</p>
                  </div>
                </div>
                {selectedThreadDetail.milestones && selectedThreadDetail.milestones.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">
                      {t('aiMemory.threadMilestones')}
                    </Label>
                    <div className="space-y-1.5 mt-1.5 max-h-56 overflow-y-auto">
                      {selectedThreadDetail.milestones.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-md border border-border/40 p-2 text-sm flex items-start gap-2"
                        >
                          <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap mt-0.5">
                            {formatDate(m.event_at || m.valid_at)}
                          </span>
                          <span className="min-w-0 flex-1">{m.fact}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selectedThreadDetail.entities && selectedThreadDetail.entities.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.threadEntities')}</Label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {selectedThreadDetail.entities.map((ent) => (
                        <Badge
                          key={ent.id}
                          variant="outline"
                          className="text-xs cursor-pointer hover:bg-muted"
                          onClick={() => openDetailDialog('entity', ent.id)}
                        >
                          {ent.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedThreadDetail.episodes && selectedThreadDetail.episodes.length > 0 && (
                  <div>
                    <Label className="text-muted-foreground">{t('aiMemory.threadEpisodes')}</Label>
                    <div className="space-y-1.5 mt-1.5 max-h-48 overflow-y-auto">
                      {selectedThreadDetail.episodes.map((ep) => (
                        <div
                          key={ep.id}
                          className="rounded-md border border-border/40 p-2 text-sm cursor-pointer hover:bg-muted/40 transition-colors"
                          onClick={() => openDetailDialog('episode', ep.id)}
                        >
                          <p className="text-[11px] font-mono text-muted-foreground mb-0.5">
                            {formatDate(ep.valid_at)}
                          </p>
                          <p className="whitespace-pre-wrap break-words">
                            {truncateText(ep.content, 200)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Migration v2.1 Audit Report Dialog */}
      <Dialog open={migrationDialogOpen} onOpenChange={setMigrationDialogOpen}>
        <DialogContent className="max-w-xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader className="shrink-0 pb-1">
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              {t('aiMemory.migrationReport')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiMemory.migrationReport')}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 py-1 space-y-3 text-sm">
            {!migrationReport ? (
              <p className="py-6 text-center text-muted-foreground">
                {t('aiMemory.migrationReportEmpty')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="default">{migrationReport.version}</Badge>
                  <Badge variant="secondary">{migrationReport.status}</Badge>
                  <Badge variant="outline">{migrationReport.duration_ms} ms</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(migrationReport.migrated_at)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-md border border-border/50 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationStatSpeakers')}
                    </p>
                    <p className="font-semibold font-mono">
                      +{migrationReport.missing_speakers_created} /{' '}
                      {migrationReport.speaker_avatars_backfilled}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/50 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationStatTags')}
                    </p>
                    <p className="font-semibold font-mono">
                      {migrationReport.non_human_speakers_demoted} /{' '}
                      {migrationReport.speaker_tags_cleaned}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/50 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationStatThreads')}
                    </p>
                    <p className="font-semibold font-mono">
                      {migrationReport.threads_active} / {migrationReport.threads_dormant} /{' '}
                      {migrationReport.threads_archived}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/50 p-2.5">
                    <p className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationStatScopeVector')}
                    </p>
                    <p className="font-semibold font-mono">
                      {migrationReport.malformed_self_scopes_fixed} /{' '}
                      {migrationReport.vector_backfill_done}/{migrationReport.vector_backfill_total}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/50 p-2.5 col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationStatDangling')}
                    </p>
                    <p className="font-semibold font-mono">
                      {migrationReport.dangling_cog_episodes_cleaned} /{' '}
                      {migrationReport.dangling_cog_env_cleaned} /{' '}
                      {migrationReport.dangling_cog_edges_cleaned}
                    </p>
                  </div>
                </div>
                {migrationReport.backup_path && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationBackupPath')}
                    </Label>
                    <p className="font-mono text-xs break-all bg-muted/40 rounded p-2 mt-1">
                      {migrationReport.backup_path}
                    </p>
                  </div>
                )}
                {migrationReport.audit_log_path && (
                  <div>
                    <Label className="text-xs text-muted-foreground">
                      {t('aiMemory.migrationAuditLog')}
                    </Label>
                    <p className="font-mono text-xs break-all bg-muted/40 rounded p-2 mt-1">
                      {migrationReport.audit_log_path}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edge Invalidate Confirmation Dialog */}
      <AlertDialog
        open={!!pendingInvalidateEdge}
        onOpenChange={(open) => !open && !invalidateEdgeLoading && setPendingInvalidateEdge(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              确认标记 Edge 失效
            </AlertDialogTitle>
            <AlertDialogDescription>
              这是软删除操作，只会设置
              invalid_at，但会影响后续记忆检索结果。请确认该关系事实确实错误或不再适用。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingInvalidateEdge && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{pendingInvalidateEdge.id}</span>
                <span>{pendingInvalidateEdge.source_entity_id}</span>
                <ChevronRight className="h-3.5 w-3.5" />
                <span>{pendingInvalidateEdge.target_entity_id}</span>
              </div>
              <p className="whitespace-pre-wrap">{pendingInvalidateEdge.fact}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={invalidateEdgeLoading}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmInvalidateEdge}
              disabled={invalidateEdgeLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {invalidateEdgeLoading ? '处理中...' : '确认失效'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear Memory Confirmation Dialog */}
      <AlertDialog open={clearMemoryDialogOpen} onOpenChange={setClearMemoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('aiMemory.clearMemoryTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('aiMemory.confirmClearMemory', {
                scope: selectedScope,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClearMemoryDialogOpen(false)}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedScope || selectedScope === 'all') return;
                setClearMemoryLoading(true);
                try {
                  const result = await memoryApi.clearMemory({ scope_key: selectedScope });
                  toast.success(
                    t('aiMemory.clearMemorySuccess', {
                      scope: selectedScope,
                      episodes: result.deleted_episodes,
                      entities: result.deleted_entities,
                      edges: result.deleted_edges,
                      threads: result.deleted_threads ?? 0,
                      preferences: result.deleted_preferences ?? 0,
                    }),
                  );
                  setClearMemoryDialogOpen(false);
                  // Refresh all data
                  const scopesData = await memoryApi.getScopes();
                  setScopes(sanitizeScopes(scopesData));
                  const statsData = await memoryApi.getStats();
                  if (statsData) setStats(statsData);
                  fetchEntities(1);
                  fetchEdges(1);
                  fetchThreads(1);
                  fetchEpisodes(1);
                } catch (_error) {
                  toast.error(t('aiMemory.clearMemoryFailed'));
                } finally {
                  setClearMemoryLoading(false);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearMemoryLoading}
            >
              {clearMemoryLoading ? t('common.loading') : t('common.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Preference Confirmation Dialog */}
      <AlertDialog
        open={!!deletingPreference}
        onOpenChange={(open) => !open && !deletingPreferenceLoading && setDeletingPreference(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              {t('common.confirm')}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('aiMemory.confirmDeletePreference')}</AlertDialogDescription>
          </AlertDialogHeader>
          {deletingPreference && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant={deletingPreference.is_correction ? 'default' : 'secondary'}>
                  {deletingPreference.polarity}
                </Badge>
                <Badge variant="outline">{deletingPreference.target_context}</Badge>
                <span className="font-mono">{deletingPreference.id}</span>
              </div>
              <p className="whitespace-pre-wrap">{deletingPreference.preference_rule}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPreferenceLoading}>
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePreference}
              disabled={deletingPreferenceLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingPreferenceLoading ? t('common.loading') : t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PinnedPage>
  );
}
