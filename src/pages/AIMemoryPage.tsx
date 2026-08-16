import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
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
  FolderTree,
  Network,
  Search,
  Trash2,
  RefreshCw,
  AlertCircle,
  Loader2,
  ChevronRight,
  Layers,
  Users,
  Settings,
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
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, agentDebugApi, cognitionApi, AgentDebugMemoryConflict, AgentDebugMemoryEdge, type CognitionAttachment, type CognitionNode } from '@/lib/api';
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
import { PinnedPage } from '@/components/layout/PinnedPage';
import MemorySettingsDialog from '@/components/memory/MemorySettingsDialog';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';

// ============================================================================
// Types
// ============================================================================

interface MemoryStats {
  scope_key: string | null;
  episode_count: number;
  entity_count: number;
  speaker_entity_count: number;
  edge_count: number;
  active_edge_count: number;
  category_count: number;
  observation_queue_size: number;
  scope_keys: string[];
}

interface MemoryScope {
  scope_key: string;
  scope_type: string;
  scope_id: string;
  episode_count: number;
  entity_count: number;
  edge_count: number;
  category_count: number;
}

interface Episode {
  id: string;
  scope_key: string;
  content: string;
  speaker_ids: string[];
  valid_at: string;
  created_at: string;
}

interface Entity {
  id: string;
  scope_key: string;
  name: string;
  summary: string;
  tag: string[];
  is_speaker: boolean;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

interface Edge {
  id: string;
  scope_key: string;
  fact: string;
  source_entity_id: string;
  target_entity_id: string;
  valid_at: string;
  invalid_at: string | null;
  created_at: string;
  mention_count?: number;
  decay_score?: number;
  last_accessed?: string | null;
}

interface Category {
  id: string;
  scope_key: string;
  name: string;
  summary: string;
  tag: string[];
  layer: number;
  parent_id: string | null;
  child_categories_count: number;
  member_entities_count: number;
  created_at: string;
  updated_at: string;
}

interface MemoryConfig {
  observer_enabled: boolean;
  observer_blacklist: string[];
  ingestion_enabled: boolean;
  batch_interval_seconds: number;
  batch_max_size: number;
  llm_semaphore_limit: number;
  enable_retrieval: boolean;
  enable_system2: boolean;
  enable_user_global_memory: boolean;
  enable_heartbeat_memory: boolean;
  retrieval_top_k: number;
  dedup_similarity_threshold: number;
  edge_conflict_threshold: number;
  min_children_per_category: number;
  max_layers: number;
  hiergraph_rebuild_ratio: number;
  hiergraph_rebuild_interval_seconds: number;
}

interface HierGraphStatus {
  scope_key: string;
  initialized: boolean;
  max_layer: number;
  last_rebuild_at: string;
  entity_count_at_last_rebuild: number;
  current_entity_count: number;
  group_summary_cache: string;
  group_summary_updated_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

interface Preference {
  id: string;
  scope_key: string;
  user_id: string;
  target_context: string;
  preference_rule: string;
  polarity: 'do' | 'dont';
  is_correction: boolean;
  is_active: boolean;
  mention_count: number;
  source_episode_id: string | null;
  created_at: string;
  updated_at: string;
  last_applied_at: string | null;
}

// ============================================================================
// API
// ============================================================================

const memoryApi = {
  getStats: (params?: { group_id?: string; scope_key?: string }) => {
    const query = new URLSearchParams();
    if (params?.group_id) query.set('group_id', params.group_id);
    if (params?.scope_key) query.set('scope_key', params.scope_key);
    const queryStr = query.toString();
    return api.get<MemoryStats>(`/api/ai/memory/stats${queryStr ? `?${queryStr}` : ''}`);
  },
  getScopes: () => api.get<MemoryScope[]>('/api/ai/memory/scopes'),
  getEpisodes: (params: { group_id?: string; scope_key?: string; all_scopes?: boolean; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.group_id) query.set('group_id', params.group_id);
    if (params.scope_key) query.set('scope_key', params.scope_key);
    if (params.all_scopes) query.set('all_scopes', 'true');
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return api.get<PaginatedResponse<Episode>>(`/api/ai/memory/episodes?${query.toString()}`);
  },
  getEpisodeDetail: (episodeId: string) =>
    api.get<Episode & { mentioned_entities: Entity[] }>(`/api/ai/memory/episodes/${episodeId}`),
  deleteEpisode: (episodeId: string) => api.delete<void>(`/api/ai/memory/episodes/${episodeId}`),
  getEntities: (params: { group_id?: string; scope_key?: string; all_scopes?: boolean; is_speaker?: boolean; search?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.group_id) query.set('group_id', params.group_id);
    if (params.scope_key) query.set('scope_key', params.scope_key);
    if (params.all_scopes) query.set('all_scopes', 'true');
    if (params.is_speaker !== undefined) query.set('is_speaker', String(params.is_speaker));
    if (params.search) query.set('search', params.search);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return api.get<PaginatedResponse<Entity>>(`/api/ai/memory/entities?${query.toString()}`);
  },
  getEntityDetail: (entityId: string) =>
    api.get<Entity & { episodes: Episode[]; edges: (Edge & { direction: string })[] }>(`/api/ai/memory/entities/${entityId}`),
  deleteEntity: (entityId: string) => api.delete<void>(`/api/ai/memory/entities/${entityId}`),
  getEdges: (params: { group_id?: string; scope_key?: string; all_scopes?: boolean; entity_id?: string; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.group_id) query.set('group_id', params.group_id);
    if (params.scope_key) query.set('scope_key', params.scope_key);
    if (params.all_scopes) query.set('all_scopes', 'true');
    if (params.entity_id) query.set('entity_id', params.entity_id);
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return api.get<PaginatedResponse<Edge>>(`/api/ai/memory/edges?${query.toString()}`);
  },
  getEdgeDetail: (edgeId: string) =>
    api.get<Edge & { source_entity: Entity; target_entity: Entity }>(`/api/ai/memory/edges/${edgeId}`),
  deleteEdge: (edgeId: string) => api.delete<void>(`/api/ai/memory/edges/${edgeId}`),
  getCategories: (params: { group_id?: string; scope_key?: string; all_scopes?: boolean; layer?: number; page?: number; page_size?: number }) => {
    const query = new URLSearchParams();
    if (params.group_id) query.set('group_id', params.group_id);
    if (params.scope_key) query.set('scope_key', params.scope_key);
    if (params.all_scopes) query.set('all_scopes', 'true');
    if (params.layer) query.set('layer', String(params.layer));
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return api.get<PaginatedResponse<Category>>(`/api/ai/memory/categories?${query.toString()}`);
  },
  getCategoryDetail: (categoryId: string) =>
    api.get<Category & { parent_categories: { id: string; name: string; layer: number }[]; child_categories: { id: string; name: string; layer: number }[]; member_entities: Entity[] }>(`/api/ai/memory/categories/${categoryId}`),
  getHierGraphStatus: (params: { group_id?: string; scope_key?: string }) => {
    const query = new URLSearchParams();
    if (params.group_id) query.set('group_id', params.group_id);
    if (params.scope_key) query.set('scope_key', params.scope_key);
    return api.get<HierGraphStatus>(`/api/ai/memory/hiergraph/status?${query.toString()}`);
  },
  getConfig: () => api.get<MemoryConfig>('/api/ai/memory/config'),
  updateConfig: (data: Partial<MemoryConfig>) => api.put<MemoryConfig>('/api/ai/memory/config', data),
  deleteScope: (scopeKey: string) =>
    api.delete<{ scope_key: string; deleted_episodes: number; deleted_entities: number; deleted_edges: number; deleted_categories: number }>(`/api/ai/memory/scopes/${encodeURIComponent(scopeKey)}`),
  clearMemory: (params: { scope_key?: string; scope_pattern?: string; dry_run?: boolean }) =>
    api.post<{
      affected_scope_keys: string[];
      deleted_episodes: number;
      deleted_entities: number;
      deleted_edges: number;
      deleted_categories: number;
    }>('/api/ai/memory/clear', params),
  getPreferences: (params: {
    scope_key?: string;
    user_id?: string;
    target_context?: string;
    is_correction?: boolean;
    polarity?: 'do' | 'dont';
    is_active?: boolean;
    all_scopes?: boolean;
    page?: number;
    page_size?: number;
  }) => {
    const query = new URLSearchParams();
    if (params.scope_key) query.set('scope_key', params.scope_key);
    if (params.user_id) query.set('user_id', params.user_id);
    if (params.target_context) query.set('target_context', params.target_context);
    if (params.is_correction !== undefined) query.set('is_correction', String(params.is_correction));
    if (params.polarity) query.set('polarity', params.polarity);
    if (params.is_active !== undefined) query.set('is_active', String(params.is_active));
    if (params.all_scopes) query.set('all_scopes', 'true');
    if (params.page) query.set('page', String(params.page));
    if (params.page_size) query.set('page_size', String(params.page_size));
    return api.get<PaginatedResponse<Preference>>(`/api/ai/memory/preferences?${query.toString()}`);
  },
  getPreferenceDetail: (prefId: string) =>
    api.get<Preference>(`/api/ai/memory/preferences/${prefId}`),
  updatePreference: (prefId: string, data: Partial<Pick<Preference, 'preference_rule' | 'polarity' | 'target_context' | 'is_active'>>) =>
    api.patch<Preference>(`/api/ai/memory/preferences/${prefId}`, data),
  deletePreference: (prefId: string) =>
    api.delete<null>(`/api/ai/memory/preferences/${prefId}`),
};

// ============================================================================
// Utility
// ============================================================================

function formatScopeType(scopeKey: string): { type: string; id: string } {
  if (scopeKey.startsWith('group:')) return { type: 'group', id: scopeKey.replace('group:', '') };
  if (scopeKey.startsWith('user_global:')) return { type: 'user_global', id: scopeKey.replace('user_global:', '') };
  if (scopeKey.startsWith('user_in_group:')) {
    const parts = scopeKey.replace('user_in_group:', '').split('@');
    return { type: 'user_in_group', id: parts[0] };
  }
  return { type: 'unknown', id: scopeKey };
}

function formatDate(dateStr: string): string {
  try { return new Date(dateStr).toLocaleString(); }
  catch { return dateStr; }
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
}

// ============================================================================
// Knowledge Graph Visualization (WebGL via sigma.js + graphology)
// ============================================================================

const CENTER_NODE_COUNT = 3;
const HUGE_GRAPH_NODE_THRESHOLD = 5000;
const FA2_MAX_NODES = 8000;       // above this the force layout is skipped (deterministic layout only)
const MAX_RENDER_EDGES = 30000;   // hard cap so layout + rendering stay bounded
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type NodeKind = 'speaker' | 'entity' | 'placeholder';

interface NodeMeta {
  id: string;
  label: string;
  degree: number;
  kind: NodeKind;
  centerRank?: number;
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
        speaker: '#60a5fa', entity: '#818cf8', placeholder: '#94a3b8', center: '#facc15',
        edge: 'rgba(96,165,250,0.7)', edgeInvalid: 'rgba(248,113,113,0.75)',
        nodeDim: 'rgba(100,116,139,0.18)', edgeDim: 'rgba(96,165,250,0.12)',
        label: '#e2e8f0', labelBg: 'rgba(15,23,42,0.78)',
      }
    : {
        speaker: '#3b82f6', entity: '#6366f1', placeholder: '#64748b', center: '#f59e0b',
        edge: 'rgba(37,99,235,0.6)', edgeInvalid: 'rgba(239,68,68,0.65)',
        nodeDim: 'rgba(148,163,184,0.22)', edgeDim: 'rgba(37,99,235,0.12)',
        label: '#1e293b', labelBg: 'rgba(255,255,255,0.82)',
      };
}

function KnowledgeGraph({
  entities,
  edges,
  categories,
  isGlass,
  isDark,
  onNodeClick,
}: {
  entities: Entity[];
  edges: Edge[];
  categories: Category[];
  isGlass: boolean;
  isDark: boolean;
  onNodeClick: (type: 'entity' | 'category', id: string) => void;
}) {
  void categories; // categories are not rendered as graph nodes (kept for API compatibility)
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Node metadata: degree, kind and TOP-N center ranking. Drives both the graph
  // build and the search panel.
  const nodeMeta = useMemo(() => {
    const degree = new Map<string, number>();
    for (const edge of edges) {
      if (edge.source_entity_id === edge.target_entity_id) continue;
      degree.set(edge.source_entity_id, (degree.get(edge.source_entity_id) || 0) + 1);
      degree.set(edge.target_entity_id, (degree.get(edge.target_entity_id) || 0) + 1);
    }
    const meta = new Map<string, NodeMeta>();
    for (const entity of entities) {
      meta.set(entity.id, {
        id: entity.id,
        label: entity.name,
        degree: degree.get(entity.id) || 0,
        kind: entity.is_speaker ? 'speaker' : 'entity',
      });
    }
    for (const edge of edges) {
      for (const id of [edge.source_entity_id, edge.target_entity_id]) {
        if (!meta.has(id)) {
          meta.set(id, { id, label: id.slice(0, 8), degree: degree.get(id) || 0, kind: 'placeholder' });
        }
      }
    }
    Array.from(meta.values())
      .filter((m) => m.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, CENTER_NODE_COUNT)
      .forEach((m, i) => { m.centerRank = i + 1; });
    return meta;
  }, [entities, edges]);

  const nodeSearchResults = useMemo(() => {
    const query = nodeSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return Array.from(nodeMeta.values())
      .filter((m) => m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8);
  }, [nodeMeta, nodeSearchQuery]);

  // Build the graphology graph + sigma renderer. Rebuilt only when data changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new Graph({ multi: true, type: 'directed' });
    const spacing = nodeMeta.size > HUGE_GRAPH_NODE_THRESHOLD ? 12 : 24;

    let index = 0;
    nodeMeta.forEach((m) => {
      const pos = phyllotaxisPosition(index++, spacing);
      const size = m.centerRank
        ? 13 - m.centerRank
        : m.kind === 'speaker' ? 6.5 : m.kind === 'placeholder' ? 3.5 : 5;
      graph.addNode(m.id, {
        x: pos.x,
        y: pos.y,
        size,
        label: truncateText(m.label, 24),
        kind: m.kind,
        centerRank: m.centerRank ?? 0,
        degree: m.degree,
      });
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

    // Draw the node label centered on the node — inside a small pill — so the
    // entity name reads as sitting inside the node rather than floating beside it.
    const drawNodeLabel = (context: CanvasRenderingContext2D, data: any, settings: any) => {
      if (!data.label) return;
      const palette = getGraphPalette(isDarkRef.current);
      const fontSize = settings.labelSize as number;
      context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
      const textWidth = context.measureText(data.label).width;
      const padX = 5;
      const boxW = textWidth + padX * 2;
      const boxH = fontSize + 6;
      context.fillStyle = palette.labelBg;
      context.beginPath();
      context.roundRect(data.x - boxW / 2, data.y - boxH / 2, boxW, boxH, 4);
      context.fill();
      context.fillStyle = (settings.labelColor && settings.labelColor.color) || palette.label;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(data.label, data.x, data.y);
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
          : data.kind === 'speaker' ? palette.speaker
          : data.kind === 'placeholder' ? palette.placeholder
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
      layoutTimer = window.setTimeout(() => {
        layout.stop();
        setIsLayoutRunning(false);
      }, Math.min(9000, 2500 + graph.order));
    }

    return () => {
      window.clearTimeout(layoutTimer);
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
    if (!renderer || !graph || !graph.hasNode(nodeId)) return;
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

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const first = nodeSearchResults[0];
    if (first) focusNode(first.id, { closeResults: true });
  }, [focusNode, nodeSearchResults]);

  const toggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
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
      style={isFullscreen ? { height: '100vh' } : { height: 'calc(100vh - 280px)', minHeight: 400 }}
    >
      <div
        ref={containerRef}
        className={cn(
          'w-full h-full glass-card',
          isFullscreen ? '' : 'rounded-lg',
        )}
        style={{ cursor: 'grab' }}
      />
      {/* Search */}
      <form
        className="absolute top-3 left-3 w-[min(360px,calc(100%-88px))] rounded-lg border border-border/50 bg-background/90 p-2 shadow-sm backdrop-blur"
        onSubmit={handleSearchSubmit}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={nodeSearchQuery}
            onChange={(e) => setNodeSearchQuery(e.target.value)}
            placeholder="搜索节点名称或 ID，回车定位"
            className="h-8 bg-background/70"
          />
        </div>
        {nodeSearchQuery.trim() && (
          <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border/40 bg-background/95">
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
                    <span className="block truncate text-xs text-muted-foreground">{node.id}</span>
                  </span>
                  <Badge variant={node.centerRank ? 'default' : 'outline'} className="shrink-0 text-[10px]">
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
      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => sigmaRef.current?.getCamera().animatedZoom()}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => sigmaRef.current?.getCamera().animatedUnzoom()}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={toggleFullscreen}>
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
      {/* Layout indicator */}
      {isLayoutRunning && (
        <button
          type="button"
          onClick={stopLayout}
          className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md bg-background/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          正在计算布局…点击停止
        </button>
      )}
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded-md px-3 py-2">
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

function StatsCard({ title, value, icon: Icon, isGlass }: { title: string; value: number; icon: React.ElementType; isGlass: boolean }) {
  return (
    <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-2 sm:p-2.5 rounded-lg bg-primary/10 shrink-0">
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-lg sm:text-xl font-bold truncate">{value.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScopeCard({ scope, isGlass, onDelete, onSelect }: { scope: MemoryScope; isGlass: boolean; onDelete: () => void; onSelect: () => void }) {
  const { type, id } = formatScopeType(scope.scope_key);
  return (
    <Card className={cn('cursor-pointer transition-all hover:shadow-md hover:border-primary/50', isGlass ? 'glass-card' : 'border border-border/50')} onClick={onSelect}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg flex items-center gap-2 min-w-0">
            {type === 'group' && <Users className="w-5 h-5 text-primary" />}
            {type === 'user_global' && <Globe className="w-5 h-5 text-primary" />}
            {type === 'user_in_group' && <Users className="w-5 h-5 text-primary" />}
            <span className="font-mono text-sm truncate">{id}</span>
          </CardTitle>
          <Badge variant="outline">{type}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-muted-foreground">对话片段</p><p className="font-semibold">{scope.episode_count}</p></div>
          <div><p className="text-muted-foreground">实体</p><p className="font-semibold">{scope.entity_count}</p></div>
          <div><p className="text-muted-foreground">关系</p><p className="font-semibold">{scope.edge_count}</p></div>
          <div><p className="text-muted-foreground">分类</p><p className="font-semibold">{scope.category_count}</p></div>
        </div>
        <div className="flex justify-end mt-4">
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-4 h-4 mr-1" />删除
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
  worldHub,
}: {
  entity: Entity;
  isGlass: boolean;
  onClick: () => void;
  worldHub?: CognitionNode | null;
}) {
  const articleCount = worldHub?.attachments?.length ?? 0;
  return (
    <Card className={cn('cursor-pointer transition-all hover:shadow-md hover:border-primary/50', isGlass ? 'glass-card' : 'border border-border/50', entity.is_speaker && 'border-l-4 border-l-primary/60')} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{entity.name}</p>
            {entity.summary && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{truncateText(entity.summary, 100)}</p>}
          </div>
          {entity.is_speaker && <Badge variant="secondary" className="shrink-0">Speaker</Badge>}
        </div>
        {(entity.tag.length > 0 || worldHub) && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entity.tag.slice(0, 3).map((tag) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
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

function EdgeItem({ edge, isGlass, onClick, sourceName, targetName }: { edge: Edge; isGlass: boolean; onClick: () => void; sourceName?: string; targetName?: string }) {
  return (
    <Card className={cn('cursor-pointer transition-all hover:shadow-md hover:border-primary/50', isGlass ? 'glass-card' : 'border border-border/50', edge.invalid_at && 'opacity-60')} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="font-medium truncate max-w-[120px] min-w-0">{sourceName || edge.source_entity_id}</span>
          <ChevronRight className="w-4 h-4 shrink-0 text-primary/50" />
          <span className="font-medium truncate max-w-[120px] min-w-0">{targetName || edge.target_entity_id}</span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{edge.fact}</p>
        <div className="flex items-center gap-2 mt-2">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{formatDate(edge.valid_at)}</span>
          {edge.invalid_at && <Badge variant="destructive" className="text-xs">已失效</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function CategoryTreeNode({
  category,
  children,
  isGlass,
  depth,
  onToggle,
  onClick,
  expandedIds,
  loadingIds,
  childrenMap,
}: {
  category: Category;
  children: Category[];
  isGlass: boolean;
  depth: number;
  onToggle: (id: string) => void;
  onClick: (id: string) => void;
  expandedIds: Set<string>;
  loadingIds?: Set<string>;
  childrenMap?: Map<string, Category[]>;
}) {
  const isExpanded = expandedIds.has(category.id);
  const isLoading = loadingIds.has(category.id);
  const hasChildren = category.child_categories_count > 0 || children.length > 0;

  const layerColors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-pink-500',
  ];

  return (
    <div className="animate-in fade-in duration-200">
      <div
        className={cn(
          'group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all hover:shadow-sm',
          isGlass ? 'hover:bg-accent/30' : 'hover:bg-accent/50'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => onClick(category.id)}
      >
        {hasChildren ? (
          <button
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-accent shrink-0 transition-colors"
            onClick={(e) => { e.stopPropagation(); onToggle(category.id); }}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <ChevronRight className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform duration-200',
                isExpanded && 'rotate-90'
              )} />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 shrink-0" />
        )}

        <div className={cn(
          'w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold text-white shrink-0',
          layerColors[depth % layerColors.length]
        )}>
          L{category.layer}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <FolderTree className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium text-sm truncate">{category.name}</span>
          </div>
          {category.summary && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 ml-5.5">{category.summary}</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {category.child_categories_count > 0 && (
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <Layers className="w-3 h-3 mr-0.5" />{category.child_categories_count}
            </Badge>
          )}
          {category.member_entities_count > 0 && (
            <Badge variant="outline" className="text-xs h-5 px-1.5">
              <Brain className="w-3 h-3 mr-0.5" />{category.member_entities_count}
            </Badge>
          )}
        </div>
      </div>

      {isExpanded && children.length > 0 && (
        <div className="mt-1">
          {children.map(child => (
            <CategoryTreeNode
              key={child.id}
              category={child}
              children={childrenMap ? childrenMap.get(child.id) || [] : []}
              isGlass={isGlass}
              depth={depth + 1}
              onToggle={onToggle}
              onClick={onClick}
              expandedIds={expandedIds}
              loadingIds={loadingIds}
              childrenMap={childrenMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoryLayerTree({
  categories,
  isGlass,
  isDark,
  onClick,
}: {
  categories: Category[];
  isGlass: boolean;
  isDark: boolean;
  onClick: (id: string) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Find max layer to determine root level
  const maxLayer = categories.length > 0 ? Math.max(...categories.map(c => c.layer)) : 0;

  // Build tree structure from categories using parent_id
  const { rootIds, childrenMap } = useMemo(() => {
    const roots = new Set<string>();
    const children = new Map<string, Category[]>();
    
    // Initialize children map for all categories
    for (const cat of categories) {
      children.set(cat.id, []);
    }
    
    // Build parent-child relationships
    for (const cat of categories) {
      if (cat.parent_id && children.has(cat.parent_id)) {
        const parentChildren = children.get(cat.parent_id)!;
        parentChildren.push(cat);
      } else {
        // No parent found, this is a root (only max layer roots are true roots)
        roots.add(cat.id);
      }
    }
    
    return { rootIds: roots, childrenMap: children };
  }, [categories]);

  // Filter to only show roots at max layer (Layer 3 in this case)
  const rootCategories = categories.filter(c => rootIds.has(c.id) && c.layer === maxLayer);

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  if (categories.length === 0) return null;

  const layerColors = [
    'bg-violet-500',
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-red-500',
    'bg-pink-500',
  ];

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('w-2.5 h-2.5 rounded-sm', layerColors[0])} />
          <span>Layer {maxLayer}</span>
        </div>
        <span className="text-xs text-muted-foreground ml-2">点击展开/收起子分类</span>
      </div>

      <div className={cn('rounded-lg p-4', isGlass ? 'glass-card' : 'border border-border/50 bg-background/50')}>
        <div className="space-y-1">
          {rootCategories.map((cat) => (
            <CategoryTreeNode
              key={cat.id}
              category={cat}
              children={childrenMap.get(cat.id) || []}
              isGlass={isGlass}
              depth={0}
              onToggle={handleToggle}
              onClick={onClick}
              expandedIds={expandedIds}
              loadingIds={new Set()}
            />
          ))}
        </div>
      </div>
    </div>
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
  const options = useMemo(() => [allLabel, ...scopes.map((s) => s.scope_key)], [allLabel, scopes]);
  const displayValue = value === 'all' ? allLabel : value;

  return (
    <InputWithDropdown
      value={displayValue}
      onChange={(val) => {
        onChange(val === allLabel ? 'all' : val);
      }}
      options={options}
      placeholder={allLabel}
      className={className}
      popoverWidth="w-[260px]"
    />
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIMemoryPage() {
  const { style, mode } = useTheme();
  const { t } = useLanguage();
  const isGlass = style === 'glassmorphism';
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [episodePage, setEpisodePage] = useState(1);
  const [entityPage, setEntityPage] = useState(1);
  const [edgePage, setEdgePage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const [totalEpisodes, setTotalEpisodes] = useState(0);
  const [totalEntities, setTotalEntities] = useState(0);
  const [totalEdges, setTotalEdges] = useState(0);
  const [totalCategories, setTotalCategories] = useState(0);
  const [selectedScope, setSelectedScope] = useState<string>('all');
  const [entitySearch, setEntitySearch] = useState('');
  const [entityFilterSpeaker, setEntityFilterSpeaker] = useState<boolean | undefined>(undefined);
  const [selectedEpisode, setSelectedEpisode] = useState<(Episode & { mentioned_entities: Entity[] }) | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<{ source_entity: Entity; target_entity: Entity } & Edge | null>(null);
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState<(Category & { parent_categories: { id: string; name: string; layer: number }[]; child_categories: { id: string; name: string; layer: number }[]; member_entities: Entity[] }) | null>(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [debugEdges, setDebugEdges] = useState<AgentDebugMemoryEdge[]>([]);
  const [debugConflicts, setDebugConflicts] = useState<AgentDebugMemoryConflict[]>([]);
  const [includeInvalidEdges, setIncludeInvalidEdges] = useState(false);
  const [isLoadingDebug, setIsLoadingDebug] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingInvalidateEdge, setPendingInvalidateEdge] = useState<Pick<Edge, 'id' | 'fact' | 'source_entity_id' | 'target_entity_id'> | null>(null);
  const [invalidateEdgeLoading, setInvalidateEdgeLoading] = useState(false);
  const [clearMemoryDialogOpen, setClearMemoryDialogOpen] = useState(false);
  const [clearMemoryLoading, setClearMemoryLoading] = useState(false);
  const [dialogType, setDialogType] = useState<'episode' | 'entity' | 'edge' | 'category' | 'world'>('episode');
  const [cognitionNodes, setCognitionNodes] = useState<CognitionNode[]>([]);
  const [selectedWorldHub, setSelectedWorldHub] = useState<CognitionNode | null>(null);
  const [previewArticle, setPreviewArticle] = useState<CognitionAttachment | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [totalPreferences, setTotalPreferences] = useState(0);
  const [preferencePage, setPreferencePage] = useState(1);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [preferenceFilter, setPreferenceFilter] = useState<'all' | 'active' | 'inactive' | 'correction'>('all');
  const [preferencePolarityFilter, setPreferencePolarityFilter] = useState<'all' | 'do' | 'dont'>('all');
  const [editingPreference, setEditingPreference] = useState<Preference | null>(null);
  const [editingPreferenceDraft, setEditingPreferenceDraft] = useState<{ preference_rule: string; polarity: 'do' | 'dont'; target_context: string; is_active: boolean } | null>(null);
  const [savingPreference, setSavingPreference] = useState(false);
  const [deletingPreference, setDeletingPreference] = useState<Preference | null>(null);
  const [deletingPreferenceLoading, setDeletingPreferenceLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [statsData, scopesData, hierData, configData] = await Promise.all([
          memoryApi.getStats().catch(() => null),
          memoryApi.getScopes().catch(() => null),
          memoryApi.getHierGraphStatus({}).catch(() => null),
          memoryApi.getConfig().catch(() => null),
        ]);
        if (statsData) setStats(statsData);

        let targetScope = 'all';
        if (scopesData && scopesData.length > 0) {
          setScopes(scopesData);
          const firstValid = scopesData.find(s => s.scope_key !== 'all' && !s.scope_key.includes('assistant'));
          targetScope = firstValid ? firstValid.scope_key : 'all';
          setSelectedScope(targetScope);
        }

        if (hierData) setHierGraphStatus(hierData);
        if (configData) setConfig(configData);

        // Load data for the first scope (or all if no scopes)
        await Promise.all([
          fetchEpisodes(1, targetScope),
          fetchEntities(1, targetScope),
          fetchEdges(1, targetScope),
          fetchCategories(1, targetScope),
          fetchCognition(targetScope),
        ]);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('aiMemory.loadFailed'));
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [t]);

  const fetchEpisodes = async (page = 1, scopeOverride?: string) => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const params: { page: number; page_size: number; scope_key?: string; all_scopes?: boolean } = { page, page_size: 20 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEpisodes(params);
      setEpisodes(data.items);
      setTotalEpisodes(data.total);
      setEpisodePage(page);
    } catch { toast.error(t('aiMemory.loadEpisodesFailed')); }
    finally { setIsLoadingData(false); }
  };

  const fetchEntities = async (page = 1, scopeOverride?: string) => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const params: { page: number; page_size: number; scope_key?: string; all_scopes?: boolean; search?: string; is_speaker?: boolean } = { page, page_size: 9999, search: entitySearch || undefined, is_speaker: entityFilterSpeaker };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEntities(params);
      setEntities(data.items);
      setTotalEntities(data.total);
      setEntityPage(page);
    } catch { toast.error(t('aiMemory.loadEntitiesFailed')); }
    finally { setIsLoadingData(false); }
  };

  const fetchEdges = async (page = 1, scopeOverride?: string) => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const params: { page: number; page_size: number; scope_key?: string; all_scopes?: boolean } = { page, page_size: 9999 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getEdges(params);
      setEdges(data.items);
      setTotalEdges(data.total);
      setEdgePage(page);
    } catch { toast.error(t('aiMemory.loadEdgesFailed')); }
    finally { setIsLoadingData(false); }
  };


  const fetchCognition = async (scopeOverride?: string) => {
    const scope = scopeOverride ?? selectedScope;
    try {
      const [publicData, scopedData] = await Promise.all([
        cognitionApi.getNodes({ limit: 100 }),
        scope && scope !== 'all'
          ? cognitionApi.getNodes({ scope_key: scope, limit: 100 })
          : Promise.resolve({ nodes: [] as CognitionNode[] }),
      ]);
      setCognitionNodes(mergeCognitionNodes(publicData.nodes, scopedData.nodes));
    } catch (error) {
      if (isCognitionBackendMissing(error)) {
        console.warn('[AIMemoryPage] /api/cognition/nodes 不可用：请升级 gsuid_core。', error);
      } else {
        console.warn('[AIMemoryPage] load cognition overlay failed:', error);
      }
      setCognitionNodes([]);
    }
  };

  const worldHubs = useMemo(() => cognitionNodes.filter(isWorldHub), [cognitionNodes]);

  const fetchCategories = async (page = 1, scopeOverride?: string) => {
    try {
      setIsLoadingData(true);
      const scope = scopeOverride ?? selectedScope;
      const params: { page: number; page_size: number; scope_key?: string; all_scopes?: boolean } = { page, page_size: 9999 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      const data = await memoryApi.getCategories(params);
      setCategories(data.items);
      setTotalCategories(data.total);
      setCategoryPage(page);
    } catch { toast.error(t('aiMemory.loadCategoriesFailed')); }
    finally { setIsLoadingData(false); }
  };


  const fetchDebugMemory = async (scopeOverride?: string) => {
    const scope = scopeOverride ?? selectedScope;
    if (!scope || scope === 'all') {
      setDebugEdges([]);
      setDebugConflicts([]);
      return;
    }
    try {
      setIsLoadingDebug(true);
      const [edgeData, conflictData] = await Promise.all([
        agentDebugApi.getMemoryEdges({ scope_key: scope, include_invalid: includeInvalidEdges, limit: 1000 }),
        agentDebugApi.getMemoryConflicts({ scope_key: scope, limit: 500 }),
      ]);
      setDebugEdges(edgeData);
      setDebugConflicts(conflictData);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg ? `加载调试记忆失败: ${errorMsg}` : '加载调试记忆失败');
    } finally {
      setIsLoadingDebug(false);
    }
  };

  const requestInvalidateEdge = (edge: Pick<Edge, 'id' | 'fact' | 'source_entity_id' | 'target_entity_id'>) => {
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
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '';
      toast.error(errorMsg || 'Edge 失效失败');
    } finally {
      setInvalidateEdgeLoading(false);
    }
  };

  const handleScopeChange = (scope: string) => {
    setSelectedScope(scope);
    setEpisodePage(1); setEntityPage(1); setEdgePage(1); setCategoryPage(1);
    // Pass scope explicitly to avoid stale closure
    fetchEpisodes(1, scope);
    fetchEntities(1, scope);
    fetchEdges(1, scope);
    fetchCategories(1, scope);
    fetchCognition(scope);
    if (activeTab === 'debug') fetchDebugMemory(scope);
    if (activeTab === 'preferences') fetchPreferences(1, scope);
  };

  // Lazy-load preferences when entering the tab so initial mount stays cheap
  useEffect(() => {
    if (activeTab === 'preferences' && preferences.length === 0 && !isLoadingPreferences) {
      fetchPreferences(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleDeleteScope = async (scopeKey: string) => {
    if (!confirm(t('aiMemory.confirmDeleteScope'))) return;
    try {
      await memoryApi.deleteScope(scopeKey);
      toast.success(t('aiMemory.scopeDeleted'));
      const scopesData = await memoryApi.getScopes();
      setScopes(scopesData);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) { const errorMsg = error instanceof Error ? error.message : ''; toast.error(errorMsg ? `${t('aiMemory.deleteScopeFailed')}: ${errorMsg}` : t('aiMemory.deleteScopeFailed')); }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEpisode'))) return;
    try {
      await memoryApi.deleteEpisode(episodeId);
      toast.success(t('aiMemory.episodeDeleted'));
      fetchEpisodes(episodePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) { const errorMsg = error instanceof Error ? error.message : ''; toast.error(errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed')); }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEntity'))) return;
    try {
      await memoryApi.deleteEntity(entityId);
      toast.success(t('aiMemory.entityDeleted'));
      fetchEntities(entityPage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) { const errorMsg = error instanceof Error ? error.message : ''; toast.error(errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed')); }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEdge'))) return;
    try {
      await memoryApi.deleteEdge(edgeId);
      toast.success(t('aiMemory.edgeDeleted'));
      fetchEdges(edgePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch (error) { const errorMsg = error instanceof Error ? error.message : ''; toast.error(errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed')); }
  };

  const fetchPreferences = async (page = 1, scopeOverride?: string) => {
    try {
      setIsLoadingPreferences(true);
      const scope = scopeOverride ?? selectedScope;
      const params: {
        page: number;
        page_size: number;
        scope_key?: string;
        all_scopes?: boolean;
        is_active?: boolean;
        is_correction?: boolean;
        polarity?: 'do' | 'dont';
      } = { page, page_size: 20 };
      if (scope !== 'all') {
        params.scope_key = scope;
      } else {
        params.all_scopes = true;
      }
      if (preferenceFilter === 'active') params.is_active = true;
      if (preferenceFilter === 'inactive') params.is_active = false;
      if (preferenceFilter === 'correction') params.is_correction = true;
      if (preferencePolarityFilter !== 'all') params.polarity = preferencePolarityFilter;
      const data = await memoryApi.getPreferences(params);
      setPreferences(data.items);
      setTotalPreferences(data.total);
      setPreferencePage(page);
    } catch {
      toast.error(t('aiMemory.loadPreferencesFailed'));
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
      const updated = await memoryApi.updatePreference(editingPreference.id, editingPreferenceDraft);
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
      toast.error(errorMsg ? `${t('aiMemory.preferenceUpdateFailed')}: ${errorMsg}` : t('aiMemory.preferenceUpdateFailed'));
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
      toast.error(errorMsg ? `${t('aiMemory.preferenceUpdateFailed')}: ${errorMsg}` : t('aiMemory.preferenceUpdateFailed'));
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
      toast.error(errorMsg ? `${t('aiMemory.deleteFailed')}: ${errorMsg}` : t('aiMemory.deleteFailed'));
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

  const openDetailDialog = async (type: 'episode' | 'entity' | 'edge' | 'category' | 'world', id: string) => {
    setDialogType(type);
    setDialogOpen(true);
    if (type === 'world') {
      const hub = worldHubs.find((h) => worldGraphId(h) === id)
        ?? cognitionNodes.find((n) => worldGraphId(n) === id);
      if (!hub) {
        setDialogOpen(false);
        return;
      }
      await hydrateWorldHub(hub);
      return;
    }
    try {
      switch (type) {
        case 'episode': { const data = await memoryApi.getEpisodeDetail(id); setSelectedEpisode(data); break; }
        case 'entity': { const data = await memoryApi.getEntityDetail(id); setSelectedEntity(data); break; }
        case 'edge': { const data = await memoryApi.getEdgeDetail(id); setSelectedEdge(data); break; }
        case 'category': { const data = await memoryApi.getCategoryDetail(id); setSelectedCategoryDetail(data); break; }
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
              source_entity: sourceEntity || { id: ed.source_entity_id, scope_key: ed.scope_key, name: ed.source_entity_id, summary: '', tag: [], is_speaker: false, user_id: null, created_at: '', updated_at: '' },
              target_entity: targetEntity || { id: ed.target_entity_id, scope_key: ed.scope_key, name: ed.target_entity_id, summary: '', tag: [], is_speaker: false, user_id: null, created_at: '', updated_at: '' },
            });
          } else setDialogOpen(false);
          break;
        }
        case 'category': {
          const cat = categories.find((c) => c.id === id);
          if (cat) setSelectedCategoryDetail({ ...cat, parent_categories: [], child_categories: [], member_entities: [] });
          else setDialogOpen(false);
          break;
        }
      }
    }
  };

  const selectedEntityConnectedEdges = useMemo(() => {
    if (!selectedEntity) return [];
    return edges
      .filter((edge) => edge.source_entity_id === selectedEntity.id || edge.target_entity_id === selectedEntity.id)
      .map((edge) => {
        const connectedEntityId = edge.source_entity_id === selectedEntity.id ? edge.target_entity_id : edge.source_entity_id;
        const connectedEntity = entities.find((entity) => entity.id === connectedEntityId);
        const direction = edge.source_entity_id === selectedEntity.id ? 'out' : 'in';
        return { edge, connectedEntityId, connectedEntity, direction };
      });
  }, [edges, entities, selectedEntity]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <PinnedPage
      header={
        /* Header */
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3"><Brain className="w-8 h-8" />{t('aiMemory.title')}</h1>
            <p className="text-muted-foreground mt-1">{t('aiMemory.description')}</p>
          </div>
          <Button
            variant="outline"
            className="h-9 self-start sm:self-auto shrink-0"
            onClick={() => setMemorySettingsOpen(true)}
          >
            <Brain className="w-4 h-4" />
            {t('memorySettings.title')}
          </Button>
        </div>
      }
    >
      <MemorySettingsDialog
        open={memorySettingsOpen}
        onOpenChange={setMemorySettingsOpen}
        scopeKey={scopes[0]?.scope_key ?? undefined}
        onAfterSave={() => setMemorySettingsVersion(v => v + 1)}
      />
      {error && (
        <Card className={cn('border-destructive/50', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="w-5 h-5" /><span>{error}</span>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground min-w-0">
            {t('aiMemory.cognitionIndexHint')}
          </p>
          <Button variant="outline" size="sm" className="h-9 shrink-0 self-start sm:self-auto" asChild>
            <Link to="/ai-runtime?tab=cognition">
              <Globe className="w-4 h-4" />
              {t('aiMemory.cognitionIndexLink')}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Stats：8 卡固定两行四列（大屏不再挤成一行） */}
      {stats && (
        <div className="glass-card-grid grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatsCard title={t('aiMemory.statsEpisodes')} value={stats.episode_count} icon={MessageSquare} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsEntities')} value={stats.entity_count} icon={Brain} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsEdges')} value={stats.edge_count} icon={GitBranch} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsCategories')} value={stats.category_count} icon={FolderTree} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsSpeakers')} value={stats.speaker_entity_count} icon={Users} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsActiveEdges')} value={stats.active_edge_count} icon={Zap} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsScopes')} value={stats.scope_keys.length} icon={Network} isGlass={isGlass} />
          <StatsCard title={t('aiMemory.statsQueue')} value={stats.observation_queue_size} icon={Clock} isGlass={isGlass} />
        </div>
      )}

      {/* Hierarchical Graph Status */}
      {hierGraphStatus && (
        <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg"><Layers className="w-5 h-5 text-primary" />{t('aiMemory.hierGraphStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><p className="text-muted-foreground">{t('aiMemory.initialized')}</p><p className="font-semibold">{hierGraphStatus.initialized ? t('common.yes') : t('common.no')}</p></div>
              <div><p className="text-muted-foreground">{t('aiMemory.maxLayer')}</p><p className="font-semibold">{hierGraphStatus.max_layer}</p></div>
              <div><p className="text-muted-foreground">{t('aiMemory.lastRebuild')}</p><p className="font-semibold">{formatDate(hierGraphStatus.last_rebuild_at)}</p></div>
              <div><p className="text-muted-foreground">{t('aiMemory.entityCountAtRebuild')}</p><p className="font-semibold">{hierGraphStatus.entity_count_at_last_rebuild}</p></div>
            </div>
            {hierGraphStatus.group_summary_cache && <div className="mt-4"><p className="text-sm text-muted-foreground">{t('aiMemory.groupSummary')}</p><p className="text-sm mt-1 p-2 bg-muted/50 rounded">{hierGraphStatus.group_summary_cache}</p></div>}
          </CardContent>
        </Card>
      )}

      {/* Tabs：与上方统计卡同宽，避免 shadow 负边距导致右边不齐 */}
      <div className="w-full min-w-0">
        <TabButtonGroup
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full max-w-full"
          options={[
            { value: 'graph', label: t('aiMemory.tabGraph'), icon: <Network className="w-4 h-4" /> },
            { value: 'world', label: t('aiMemory.tabWorld'), icon: <BookOpen className="w-4 h-4" /> },
            { value: 'search', label: t('aiMemory.tabSearch'), icon: <Search className="w-4 h-4" /> },
            { value: 'preferences', label: t('aiMemory.tabPreferences'), icon: <ListChecks className="w-4 h-4" /> },
            { value: 'scopes', label: t('aiMemory.tabScopes'), icon: <Globe className="w-4 h-4" /> },
            { value: 'episodes', label: t('aiMemory.tabEpisodes'), icon: <MessageSquare className="w-4 h-4" /> },
            { value: 'entities', label: t('aiMemory.tabEntities'), icon: <Brain className="w-4 h-4" /> },
            { value: 'edges', label: t('aiMemory.tabEdges'), icon: <GitBranch className="w-4 h-4" /> },
            { value: 'categories', label: t('aiMemory.tabCategories'), icon: <FolderTree className="w-4 h-4" /> },
            { value: 'debug', label: '调试视图', icon: <AlertCircle className="w-4 h-4" /> },
            { value: 'config', label: t('aiMemory.tabConfig'), icon: <Settings className="w-4 h-4" /> },
          ]}
        />
      </div>

      {activeTab === 'search' && (
        <div className="space-y-4">
          <MemorySearchPanel />
        </div>
      )}

      {/* Knowledge Graph Tab */}
      {activeTab === 'graph' && (
      <div className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{t('aiMemory.graphDescription')}</p>
            {/* 移动端：左 scope 列表，右两个操作按钮；桌面同理保持一行 */}
            <div className="flex w-full min-w-0 items-center gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="h-9 min-w-0 flex-1 sm:max-w-[220px] sm:flex-none sm:w-[180px]"
              />
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 sm:px-3"
                  onClick={() => setClearMemoryDialogOpen(true)}
                  disabled={selectedScope === 'all' || !selectedScope}
                  title={t('aiMemory.clearMemory')}
                  aria-label={t('aiMemory.clearMemory')}
                >
                  <Trash2 className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('aiMemory.clearMemory')}</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-2.5 sm:px-3"
                  onClick={() => { fetchEntities(1); fetchEdges(1); fetchCategories(1); fetchCognition(); }}
                  title={t('common.refresh')}
                  aria-label={t('common.refresh')}
                >
                  <RefreshCw className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t('common.refresh')}</span>
                </Button>
              </div>
            </div>
          </div>
          {entities.length === 0 && edges.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
                <Network className="w-12 h-12 mb-4 opacity-50" />
                <p>{t('aiMemory.noGraphData')}</p>
              </CardContent>
            </Card>
          ) : (
            <KnowledgeGraph
              entities={entities}
              edges={edges}
              categories={categories}
              isGlass={isGlass}
              isDark={isDark}
              onNodeClick={(type, id) => openDetailDialog(type, id)}
            />
          )}
      </div>
      )}

      {activeTab === 'world' && (
      <div className="space-y-4">
        <div className="flex w-full min-w-0 items-center gap-2">
          <p className="text-sm text-muted-foreground min-w-0 flex-1">{t('aiMemory.worldTabDescription')}</p>
          <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => fetchCognition()}>
            <RefreshCw className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">{t('common.refresh')}</span>
          </Button>
        </div>
        {worldHubs.length === 0 ? (
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
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
          />
        )}
      </div>
      )}

      {/* Preferences Tab */}
      {activeTab === 'preferences' && (
      <div className="space-y-4">
        <div className={cn('rounded-lg p-3 text-sm', isGlass ? 'glass-card' : 'border border-border/50 bg-card')}>
          <div className="flex items-start gap-2">
            <ListChecks className="w-4 h-4 mt-0.5 text-primary shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">{t('aiMemory.tabPreferences')}</p>
              <p className="text-muted-foreground">{t('aiMemory.preferencesDescription')}</p>
              <p className="text-xs text-muted-foreground">{t('aiMemory.preferencesHint')}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-sm text-muted-foreground">{t('aiMemory.preferenceCount', { count: preferences.length, total: totalPreferences })}</p>
          <div className="flex flex-wrap items-center gap-2">
            <ScopeSelector
              value={selectedScope}
              onChange={handleScopeChange}
              scopes={scopes}
              allLabel={t('aiMemory.preferenceScopeAll')}
              className="w-[180px] h-9"
            />
            <Select value={preferenceFilter} onValueChange={(v) => { setPreferenceFilter(v as typeof preferenceFilter); setPreferencePage(1); setTimeout(() => fetchPreferences(1), 0); }}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('aiMemory.preferenceFilterAll')}</SelectItem>
                <SelectItem value="active">{t('aiMemory.preferenceFilterActive')}</SelectItem>
                <SelectItem value="inactive">{t('aiMemory.preferenceFilterInactive')}</SelectItem>
                <SelectItem value="correction">{t('aiMemory.preferenceFilterCorrection')}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={preferencePolarityFilter} onValueChange={(v) => { setPreferencePolarityFilter(v as typeof preferencePolarityFilter); setPreferencePage(1); setTimeout(() => fetchPreferences(1), 0); }}>
              <SelectTrigger className="h-9 w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('aiMemory.preferenceFilterAll')}</SelectItem>
                <SelectItem value="do">{t('aiMemory.preferenceFilterDo')}</SelectItem>
                <SelectItem value="dont">{t('aiMemory.preferenceFilterDont')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-9" onClick={() => fetchPreferences(preferencePage)}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
          </div>
        </div>

        {isLoadingPreferences ? (
          <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
        ) : preferences.length === 0 ? (
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground">
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
              const ctx = draft?.target_context ?? pref.target_context;
              const active = draft?.is_active ?? pref.is_active;
              return (
                <Card key={pref.id} className={cn('transition-all', isGlass ? 'glass-card' : 'border border-border/50', !pref.is_active && 'opacity-70')}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Badge variant={pref.is_correction ? 'default' : 'secondary'}>
                          {pref.is_correction ? t('aiMemory.preferenceCorrection') : polarity === 'do' ? t('aiMemory.preferencePolarityDo') : t('aiMemory.preferencePolarityDont')}
                        </Badge>
                        <Badge variant={pref.is_active ? 'outline' : 'destructive'}>
                          {pref.is_active ? t('aiMemory.preferenceActive') : t('aiMemory.preferenceInactive')}
                        </Badge>
                        <Badge variant="outline" className="font-mono text-xs">{pref.target_context}</Badge>
                        <span className="font-mono text-xs text-muted-foreground truncate">{pref.id}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 shrink-0">
                        <Button variant="ghost" size="sm" onClick={() => togglePreferenceActive(pref)} title={pref.is_active ? t('aiMemory.preferenceDisable') : t('aiMemory.preferenceEnable')}>
                          <Power className={cn('w-4 h-4', pref.is_active ? 'text-amber-500' : 'text-emerald-500')} />
                        </Button>
                        {isEditing ? (
                          <>
                            <Button variant="default" size="sm" disabled={savingPreference} onClick={saveEditPreference}>
                              {savingPreference ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}{t('common.save')}
                            </Button>
                            <Button variant="ghost" size="sm" disabled={savingPreference} onClick={cancelEditPreference}>
                              <X className="w-4 h-4 mr-1" />{t('common.cancel')}
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => startEditPreference(pref)} title={t('aiMemory.preferenceEdit')}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletingPreference(pref)} title={t('common.delete')}>
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
                            onChange={(e) => setEditingPreferenceDraft({ ...draft, preference_rule: e.target.value })}
                            placeholder={t('aiMemory.preferenceRulePlaceholder')}
                            rows={3}
                            maxLength={2000}
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label>{t('aiMemory.preferencePolarity')}</Label>
                            <Select value={draft.polarity} onValueChange={(v) => setEditingPreferenceDraft({ ...draft, polarity: v as 'do' | 'dont' })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="do">{t('aiMemory.preferencePolarityDo')}</SelectItem>
                                <SelectItem value="dont">{t('aiMemory.preferencePolarityDont')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label>{t('aiMemory.preferenceContext')}</Label>
                            <Input
                              value={draft.target_context}
                              onChange={(e) => setEditingPreferenceDraft({ ...draft, target_context: e.target.value })}
                              placeholder={t('aiMemory.preferenceContextPlaceholder')}
                              maxLength={128}
                            />
                            <p className="text-xs text-muted-foreground">{t('aiMemory.preferenceContextHelp')}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                          <div>
                            <Label className="text-sm">{t('aiMemory.preferenceIsActive')}</Label>
                          </div>
                          <Switch checked={draft.is_active} onCheckedChange={(v) => setEditingPreferenceDraft({ ...draft, is_active: v })} />
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{ruleText}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{pref.user_id}</span>
                      <span className="flex items-center gap-1"><Layers className="w-3 h-3" />{pref.scope_key}</span>
                      <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{t('aiMemory.preferenceMentionCount')}: {pref.mention_count}</span>
                      {pref.source_episode_id && (
                        <span className="flex items-center gap-1 font-mono truncate max-w-[200px]" title={pref.source_episode_id}>
                          <GitBranch className="w-3 h-3" />{pref.source_episode_id}
                        </span>
                      )}
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t('aiMemory.updatedAt')}: {formatDate(pref.updated_at)}</span>
                      {pref.last_applied_at && (
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{t('aiMemory.preferenceLastApplied')}: {formatDate(pref.last_applied_at)}</span>
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
            <Button variant="outline" size="sm" disabled={preferencePage <= 1} onClick={() => fetchPreferences(preferencePage - 1)}>{t('common.previousPage')}</Button>
            <span className="flex items-center text-sm text-muted-foreground">{preferencePage} / {Math.ceil(totalPreferences / 20)}</span>
            <Button variant="outline" size="sm" disabled={preferencePage >= Math.ceil(totalPreferences / 20)} onClick={() => fetchPreferences(preferencePage + 1)}>{t('common.nextPage')}</Button>
          </div>
        )}
      </div>
      )}

      {/* Scopes Tab */}
      {activeTab === 'scopes' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.scopeCount', { count: scopes.length })}</p>
            <Button variant="outline" size="sm" onClick={async () => { const data = await memoryApi.getScopes(); setScopes(data); }}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
          </div>
          <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scopes.map((scope) => <ScopeCard key={scope.scope_key} scope={scope} isGlass={isGlass} onDelete={() => handleDeleteScope(scope.scope_key)} onSelect={() => handleScopeChange(scope.scope_key)} />)}
          </div>
          {scopes.length === 0 && (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><Network className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noScopes')}</p></CardContent>
            </Card>
          )}
      </div>
      )}

      {/* Episodes Tab */}
      {activeTab === 'episodes' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.episodeCount', { count: episodes.length, total: totalEpisodes })}</p>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={() => fetchEpisodes(episodePage)}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
            </div>
          </div>
          {isLoadingData ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : episodes.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><MessageSquare className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noEpisodes')}</p></CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {episodes.map((episode) => (
                <Card key={episode.id} className={cn('cursor-pointer transition-all hover:shadow-md hover:border-primary/50', isGlass ? 'glass-card' : 'border border-border/50')} onClick={() => openDetailDialog('episode', episode.id)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm line-clamp-3">{truncateText(episode.content, 200)}</p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{episode.speaker_ids.length} {t('aiMemory.speakers')}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(episode.valid_at)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); handleDeleteEpisode(episode.id); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {totalEpisodes > 20 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={episodePage <= 1} onClick={() => fetchEpisodes(episodePage - 1)}>{t('common.previousPage')}</Button>
              <span className="flex items-center text-sm text-muted-foreground">{episodePage} / {Math.ceil(totalEpisodes / 20)}</span>
              <Button variant="outline" size="sm" disabled={episodePage >= Math.ceil(totalEpisodes / 20)} onClick={() => fetchEpisodes(episodePage + 1)}>{t('common.nextPage')}</Button>
            </div>
          )}
      </div>
      )}

      {/* Entities Tab */}
      {activeTab === 'entities' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input placeholder={t('aiMemory.searchEntities')} value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} className="max-w-xs" />
              <Button variant="outline" size="sm" onClick={() => fetchEntities(1)}>{t('common.search')}</Button>
            </div>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={() => { setEntityFilterSpeaker(entityFilterSpeaker === undefined ? true : entityFilterSpeaker === true ? false : undefined); fetchEntities(1); }}>
                <Users className="w-4 h-4 mr-1" />
                {entityFilterSpeaker === true ? t('aiMemory.speakersOnly') : entityFilterSpeaker === false ? t('aiMemory.nonSpeakersOnly') : t('aiMemory.allUsers')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchEntities(entityPage)}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t('aiMemory.entityCount', { count: entities.length, total: totalEntities })}</p>
          {isLoadingData ? (
            <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : entities.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><Brain className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noEntities')}</p></CardContent>
            </Card>
          ) : (
            <div className="glass-card-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <div key={entity.id} className="relative group">
                  <EntityNode
                    entity={entity}
                    isGlass={isGlass}
                    worldHub={hubForEntity(entity.id, entity.name, cognitionNodes)}
                    onClick={() => openDetailDialog('entity', entity.id)}
                  />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteEntity(entity.id); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
          {totalEntities > 20 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={entityPage <= 1} onClick={() => fetchEntities(entityPage - 1)}>{t('common.previousPage')}</Button>
              <span className="flex items-center text-sm text-muted-foreground">{entityPage} / {Math.ceil(totalEntities / 20)}</span>
              <Button variant="outline" size="sm" disabled={entityPage >= Math.ceil(totalEntities / 20)} onClick={() => fetchEntities(entityPage + 1)}>{t('common.nextPage')}</Button>
            </div>
          )}
      </div>
      )}

      {/* Edges Tab */}
      {activeTab === 'edges' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.edgeCount', { count: edges.length, total: totalEdges })}</p>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={() => fetchEdges(edgePage)}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
            </div>
          </div>
          {isLoadingData ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
          ) : edges.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><GitBranch className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noEdges')}</p></CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {edges.map((edge) => (
                <div key={edge.id} className="relative group">
                  <EdgeItem edge={edge} isGlass={isGlass} onClick={() => openDetailDialog('edge', edge.id)} sourceName={entities.find((e) => e.id === edge.source_entity_id)?.name} targetName={entities.find((e) => e.id === edge.target_entity_id)?.name} />
                  <Button variant="ghost" size="sm" className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteEdge(edge.id); }}><Trash2 className="w-4 h-4" /></Button>
                </div>
              ))}
            </div>
          )}
          {totalEdges > 20 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={edgePage <= 1} onClick={() => fetchEdges(edgePage - 1)}>{t('common.previousPage')}</Button>
              <span className="flex items-center text-sm text-muted-foreground">{edgePage} / {Math.ceil(totalEdges / 20)}</span>
              <Button variant="outline" size="sm" disabled={edgePage >= Math.ceil(totalEdges / 20)} onClick={() => fetchEdges(edgePage + 1)}>{t('common.nextPage')}</Button>
            </div>
          )}
      </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.categoryCount', { count: categories.length, total: totalCategories })}</p>
            <div className="flex gap-2">
              <ScopeSelector
                value={selectedScope}
                onChange={handleScopeChange}
                scopes={scopes}
                allLabel={t('aiMemory.allScopes')}
                className="w-[180px]"
              />
              <Button variant="outline" size="sm" onClick={() => fetchCategories(categoryPage)}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
            </div>
          </div>
          {isLoadingData ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : categories.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><FolderTree className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noCategories')}</p></CardContent>
            </Card>
          ) : (
            <CategoryLayerTree
              categories={categories}
              isGlass={isGlass}
              isDark={isDark}
              onClick={(id) => openDetailDialog('category', id)}
            />
          )}
      </div>
      )}

      {/* Agent Debug Tab */}
      {activeTab === 'debug' && (
        <div className="space-y-4">
          <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-primary" />Memory Graph Debug</CardTitle>
              <CardDescription>使用 Agent Debug API 查看指定 scope 的 Edge 与矛盾记录，并可软删除错误 Edge。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                    <Switch checked={includeInvalidEdges} onCheckedChange={setIncludeInvalidEdges} />
                    <Label className="text-sm">包含已失效 Edge</Label>
                  </div>
                  <Button onClick={() => fetchDebugMemory()} disabled={selectedScope === 'all' || isLoadingDebug}>
                    {isLoadingDebug ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                    查询调试数据
                  </Button>
                </div>
              </div>
              {selectedScope === 'all' && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600">
                  Agent Debug 接口要求指定明确 scope_key，请先选择如 group:789012 的范围。
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <Card className={cn('xl:col-span-2', isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span>Edge 列表</span>
                  <Badge variant="outline">{debugEdges.length}</Badge>
                </CardTitle>
                <CardDescription>仅软删除 Edge，不会物理删除数据库记录。</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingDebug ? (
                  <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>
                ) : debugEdges.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">暂无 Edge 数据</div>
                ) : (
                  <div className="space-y-3 max-h-[640px] overflow-auto pr-1">
                    {debugEdges.map((edge) => (
                      <div key={edge.id} className={cn('rounded-lg border border-border/50 p-4', edge.invalid_at && 'opacity-60')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={edge.invalid_at ? 'destructive' : 'default'}>{edge.invalid_at ? '已失效' : '有效'}</Badge>
                              <span className="font-mono text-xs text-muted-foreground">{edge.id}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{edge.fact}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>源: {edge.source_entity_id}</span>
                              <span>目标: {edge.target_entity_id}</span>
                              <span>提及: {edge.mention_count ?? 0}</span>
                              <span>评分: {typeof edge.decay_score === 'number' ? edge.decay_score.toFixed(3) : '-'}</span>
                              <span>最近访问: {edge.last_accessed ? formatDate(edge.last_accessed) : '-'}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={!!edge.invalid_at} onClick={() => requestInvalidateEdge(edge)}>
                            <Trash2 className="w-4 h-4 mr-1" />失效
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
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
                      <div key={conflict.id} className="rounded-lg border border-border/50 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="secondary">{conflict.fact_signature}</Badge>
                          <span className="text-xs text-muted-foreground">{conflict.created_at ? formatDate(conflict.created_at) : '-'}</span>
                        </div>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{conflict.summary}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
      <div className="space-y-4">
          {config && (
            <>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader><CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5" />{t('aiMemory.observerSettings')}</CardTitle><CardDescription>{t('aiMemory.observerSettingsDesc')}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div><Label>{t('aiMemory.observerEnabled')}</Label><p className="text-sm text-muted-foreground">{t('aiMemory.observerEnabledDesc')}</p></div>
                    <Switch checked={config.observer_enabled} disabled />
                  </div>
                  {config.observer_blacklist.length > 0 && <div><Label>{t('aiMemory.observerBlacklist')}</Label><div className="flex flex-wrap gap-2 mt-2">{config.observer_blacklist.map((id) => <Badge key={id} variant="outline">{id}</Badge>)}</div></div>}
                </CardContent>
              </Card>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />{t('aiMemory.ingestionSettings')}</CardTitle><CardDescription>{t('aiMemory.ingestionSettingsDesc')}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><Label className="text-muted-foreground">{t('aiMemory.ingestionEnabled')}</Label><p className="font-semibold">{config.ingestion_enabled ? t('common.enabled') : t('common.disabled')}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.batchInterval')}</Label><p className="font-semibold">{config.batch_interval_seconds}s</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.batchMaxSize')}</Label><p className="font-semibold">{config.batch_max_size}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.llmSemaphore')}</Label><p className="font-semibold">{config.llm_semaphore_limit}</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader><CardTitle className="flex items-center gap-2"><Search className="w-5 h-5" />{t('aiMemory.retrievalSettings')}</CardTitle><CardDescription>{t('aiMemory.retrievalSettingsDesc')}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><Label className="text-muted-foreground">{t('aiMemory.enableRetrieval')}</Label><p className="font-semibold">{config.enable_retrieval ? t('common.enabled') : t('common.disabled')}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.enableSystem2')}</Label><p className="font-semibold">{config.enable_system2 ? t('common.enabled') : t('common.disabled')}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.enableUserGlobalMemory')}</Label><p className="font-semibold">{config.enable_user_global_memory ? t('common.enabled') : t('common.disabled')}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.enableHeartbeatMemory')}</Label><p className="font-semibold">{config.enable_heartbeat_memory ? t('common.enabled') : t('common.disabled')}</p></div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><Label className="text-muted-foreground">{t('aiMemory.retrievalTopK')}</Label><p className="font-semibold">{config.retrieval_top_k}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.dedupThreshold')}</Label><p className="font-semibold">{(config.dedup_similarity_threshold * 100).toFixed(0)}%</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.edgeConflictThreshold')}</Label><p className="font-semibold">{(config.edge_conflict_threshold * 100).toFixed(0)}%</p></div>
                  </div>
                </CardContent>
              </Card>
              <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
                <CardHeader><CardTitle className="flex items-center gap-2"><Layers className="w-5 h-5" />{t('aiMemory.hierGraphSettings')}</CardTitle><CardDescription>{t('aiMemory.hierGraphSettingsDesc')}</CardDescription></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div><Label className="text-muted-foreground">{t('aiMemory.minChildrenPerCategory')}</Label><p className="font-semibold">{config.min_children_per_category}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.maxLayers')}</Label><p className="font-semibold">{config.max_layers}</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.hierGraphRebuildRatio')}</Label><p className="font-semibold">{(config.hiergraph_rebuild_ratio * 100).toFixed(0)}%</p></div>
                    <div><Label className="text-muted-foreground">{t('aiMemory.hierGraphRebuildInterval')}</Label><p className="font-semibold">{(config.hiergraph_rebuild_interval_seconds / 3600).toFixed(0)}h</p></div>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'episode' && t('aiMemory.episodeDetail')}
              {dialogType === 'entity' && t('aiMemory.entityDetail')}
              {dialogType === 'edge' && t('aiMemory.edgeDetail')}
              {dialogType === 'category' && t('aiMemory.categoryDetail')}
              {dialogType === 'world' && t('aiMemory.worldHubDetail')}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('aiMemory.detailAriaDesc')}
            </DialogDescription>
          </DialogHeader>
          {dialogType === 'episode' && selectedEpisode && (
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label><p className="font-mono text-sm">{selectedEpisode.scope_key}</p></div>
              <div><Label className="text-muted-foreground">{t('aiMemory.content')}</Label><p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">{selectedEpisode.content}</p></div>
              <div><Label className="text-muted-foreground">{t('aiMemory.speakers')}</Label><div className="flex flex-wrap gap-2 mt-2">{selectedEpisode.speaker_ids.map((id) => <Badge key={id} variant="outline">{id}</Badge>)}</div></div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.validAt')}</Label><p>{formatDate(selectedEpisode.valid_at)}</p></div>
                <div><Label className="text-muted-foreground">{t('aiMemory.createdAt')}</Label><p>{formatDate(selectedEpisode.created_at)}</p></div>
              </div>
              {selectedEpisode.mentioned_entities.length > 0 && <div><Label className="text-muted-foreground">{t('aiMemory.mentionedEntities')}</Label><div className="flex flex-wrap gap-2 mt-2">{selectedEpisode.mentioned_entities.map((e) => <Badge key={e.id} variant="secondary">{e.name}</Badge>)}</div></div>}
            </div>
          )}
          {dialogType === 'entity' && selectedEntity && (
            <div className="space-y-4">
              <div className={cn('rounded-lg p-4', isGlass ? 'glass-card' : 'border border-border/50 bg-card')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                  <div><Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label><p className="font-mono text-sm break-all">{selectedEntity.scope_key}</p></div>
                  <div><Label className="text-muted-foreground">{t('aiMemory.name')}</Label><p className="font-medium">{selectedEntity.name}</p></div>
                  <div><Label className="text-muted-foreground">{t('aiMemory.isSpeaker')}</Label><p>{selectedEntity.is_speaker ? t('common.yes') : t('common.no')}</p></div>
                  {selectedEntity.user_id && <div><Label className="text-muted-foreground">{t('aiMemory.userId')}</Label><p className="font-mono">{selectedEntity.user_id}</p></div>}
                  <div><Label className="text-muted-foreground">{t('aiMemory.createdAt')}</Label><p>{formatDate(selectedEntity.created_at)}</p></div>
                  <div><Label className="text-muted-foreground">{t('aiMemory.updatedAt')}</Label><p>{formatDate(selectedEntity.updated_at)}</p></div>
                </div>
                {selectedEntity.summary && <div className="mt-4"><Label className="text-muted-foreground">{t('aiMemory.summary')}</Label><p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">{selectedEntity.summary}</p></div>}
                {selectedEntity.tag.length > 0 && <div className="mt-4"><Label className="text-muted-foreground">{t('aiMemory.tags')}</Label><div className="flex flex-wrap gap-2 mt-2">{selectedEntity.tag.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></div>}
                {(() => {
                  const hub = hubForEntity(selectedEntity.id, selectedEntity.name, cognitionNodes);
                  if (!hub) return null;
                  const articles = hub.attachments ?? [];
                  return (
                    <div className="mt-4 space-y-2">
                      <Label className="text-muted-foreground">{t('aiMemory.worldKnowledge')}</Label>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-2 rounded-md border border-border/50 p-3 text-left hover:bg-accent/40"
                        onClick={() => openDetailDialog('world', worldGraphId(hub))}
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 font-medium">
                            <Globe className="w-4 h-4 shrink-0" />
                            <span className="truncate">{hub.title || hub.ref}</span>
                          </span>
                          <span className="mt-1 block font-mono text-xs text-muted-foreground break-all">{hub.ref}</span>
                        </span>
                        <Badge variant="secondary" className="shrink-0">
                          {t('aiMemory.articleCount', { count: articles.length })}
                        </Badge>
                      </button>
                      {articles.length > 0 && (
                        <CognitionAttachments
                          attachments={articles}
                          openLabel={t('aiMemory.openArticle')}
                          writableLabel={t('aiMemory.articleWritable')}
                          readonlyLabel={t('aiMemory.articleReadonly')}
                        />
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className={cn('rounded-lg p-4', isGlass ? 'glass-card' : 'border border-border/50 bg-card')}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">相连实体与关系 Edge</h3>
                    <p className="text-xs text-muted-foreground">展示所有与当前实体直接相连的实体，可对错误 Edge 标记失效。</p>
                  </div>
                  <Badge variant="outline">{selectedEntityConnectedEdges.length}</Badge>
                </div>
                {selectedEntityConnectedEdges.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">暂无直接相连实体</div>
                ) : (
                  <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
                    {selectedEntityConnectedEdges.map(({ edge, connectedEntity, connectedEntityId, direction }) => (
                      <div key={edge.id} className={cn('rounded-lg border border-border/50 p-3', edge.invalid_at && 'opacity-60')}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={edge.invalid_at ? 'destructive' : 'default'}>{edge.invalid_at ? '已失效' : '有效'}</Badge>
                              <Badge variant="outline">{direction === 'out' ? '当前实体 → 对方' : '对方 → 当前实体'}</Badge>
                              <span className="font-mono text-xs text-muted-foreground">{edge.id}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium truncate">{selectedEntity.name}</span>
                              <ChevronRight className={cn('h-4 w-4 text-primary/60', direction === 'in' && 'rotate-180')} />
                              <button
                                type="button"
                                className="font-medium text-primary hover:underline truncate"
                                onClick={() => openDetailDialog('entity', connectedEntityId)}
                              >
                                {connectedEntity?.name || connectedEntityId}
                              </button>
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{edge.fact}</p>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                              <span>生效: {edge.valid_at ? formatDate(edge.valid_at) : '-'}</span>
                              <span>提及: {edge.mention_count ?? '-'}</span>
                              <span>评分: {typeof edge.decay_score === 'number' ? edge.decay_score.toFixed(3) : '-'}</span>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="shrink-0 text-destructive hover:text-destructive" disabled={!!edge.invalid_at} onClick={() => requestInvalidateEdge(edge)}>
                            <Trash2 className="w-4 h-4 mr-1" />失效
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {dialogType === 'edge' && selectedEdge && (
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label><p className="font-mono text-sm">{selectedEdge.scope_key}</p></div>
              <div><Label className="text-muted-foreground">{t('aiMemory.fact')}</Label><p className="mt-1 p-2 bg-muted/50 rounded text-sm">{selectedEdge.fact}</p></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label className="text-muted-foreground">{t('aiMemory.sourceEntity')}</Label><p className="font-medium">{selectedEdge.source_entity.name}</p>{selectedEdge.source_entity.summary && <p className="text-sm text-muted-foreground mt-1">{truncateText(selectedEdge.source_entity.summary, 100)}</p>}</div>
                <div><Label className="text-muted-foreground">{t('aiMemory.targetEntity')}</Label><p className="font-medium">{selectedEdge.target_entity.name}</p>{selectedEdge.target_entity.summary && <p className="text-sm text-muted-foreground mt-1">{truncateText(selectedEdge.target_entity.summary, 100)}</p>}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.validAt')}</Label><p>{formatDate(selectedEdge.valid_at)}</p></div>
                {selectedEdge.invalid_at && <div><Label className="text-muted-foreground">{t('aiMemory.invalidAt')}</Label><p className="text-destructive">{formatDate(selectedEdge.invalid_at)}</p></div>}
              </div>
            </div>
          )}
          {dialogType === 'world' && selectedWorldHub && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="gap-1">
                  <Globe className="w-3 h-3" />
                  {t('aiMemory.legendWorld')}
                </Badge>
                {selectedWorldHub.source && <Badge variant="outline">{selectedWorldHub.source}</Badge>}
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
                  <p className="mt-1 p-2 bg-muted/50 rounded text-sm whitespace-pre-wrap">{selectedWorldHub.summary}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{t('aiMemory.scopeKey')}: {selectedWorldHub.scope_key || t('aiMemory.publicWorldScope')}</span>
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
          {dialogType === 'category' && selectedCategoryDetail && (
            <div className="space-y-4">
              <div><Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label><p className="font-mono text-sm">{selectedCategoryDetail.scope_key}</p></div>
              <div><Label className="text-muted-foreground">{t('aiMemory.name')}</Label><p className="font-medium">{selectedCategoryDetail.name}</p></div>
              {selectedCategoryDetail.summary && <div><Label className="text-muted-foreground">{t('aiMemory.summary')}</Label><p className="mt-1 p-2 bg-muted/50 rounded text-sm">{selectedCategoryDetail.summary}</p></div>}
              {selectedCategoryDetail.tag.length > 0 && <div><Label className="text-muted-foreground">{t('aiMemory.tags')}</Label><div className="flex flex-wrap gap-2 mt-2">{selectedCategoryDetail.tag.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></div>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.layer')}</Label><p className="font-semibold">{selectedCategoryDetail.layer}</p></div>
                <div><Label className="text-muted-foreground">{t('aiMemory.memberEntities')}</Label><p className="font-semibold">{selectedCategoryDetail.member_entities_count}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.createdAt')}</Label><p>{formatDate(selectedCategoryDetail.created_at)}</p></div>
                <div><Label className="text-muted-foreground">{t('aiMemory.updatedAt')}</Label><p>{formatDate(selectedCategoryDetail.updated_at)}</p></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edge Invalidate Confirmation Dialog */}
      <AlertDialog open={!!pendingInvalidateEdge} onOpenChange={(open) => !open && !invalidateEdgeLoading && setPendingInvalidateEdge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              确认标记 Edge 失效
            </AlertDialogTitle>
            <AlertDialogDescription>
              这是软删除操作，只会设置 invalid_at，但会影响后续记忆检索结果。请确认该关系事实确实错误或不再适用。
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
            <AlertDialogCancel onClick={() => setClearMemoryDialogOpen(false)}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!selectedScope || selectedScope === 'all') return;
                setClearMemoryLoading(true);
                try {
                  const result = await memoryApi.clearMemory({ scope_key: selectedScope });
                  toast.success(t('aiMemory.clearMemorySuccess', {
                    scope: selectedScope,
                    episodes: result.deleted_episodes,
                    entities: result.deleted_entities,
                    edges: result.deleted_edges,
                    categories: result.deleted_categories,
                  }));
                  setClearMemoryDialogOpen(false);
                  // Refresh all data
                  const scopesData = await memoryApi.getScopes();
                  setScopes(scopesData);
                  const statsData = await memoryApi.getStats();
                  if (statsData) setStats(statsData);
                  fetchEntities(1);
                  fetchEdges(1);
                  fetchCategories(1);
                  fetchEpisodes(1);
                } catch (error) {
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
      <AlertDialog open={!!deletingPreference} onOpenChange={(open) => !open && !deletingPreferenceLoading && setDeletingPreference(null)}>
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
                <Badge variant={deletingPreference.is_correction ? 'default' : 'secondary'}>{deletingPreference.polarity}</Badge>
                <Badge variant="outline">{deletingPreference.target_context}</Badge>
                <span className="font-mono">{deletingPreference.id}</span>
              </div>
              <p className="whitespace-pre-wrap">{deletingPreference.preference_rule}</p>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingPreferenceLoading}>{t('common.cancel')}</AlertDialogCancel>
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
