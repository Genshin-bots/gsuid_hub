import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TabButtonGroup } from '@/components/ui/TabButtonGroup';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  ZoomIn,
  ZoomOut,
  Maximize2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';

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
}

interface Category {
  id: string;
  scope_key: string;
  name: string;
  summary: string;
  tag: string[];
  layer: number;
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
// Knowledge Graph Visualization (Canvas-based)
// ============================================================================

interface GraphNode {
  id: string;
  label: string;
  type: 'entity' | 'category';
  x: number;
  y: number;
  vx: number;
  vy: number;
  isSpeaker?: boolean;
  layer?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
  invalid?: boolean;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<string | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const animFrameRef = useRef<number>(0);
  const alphaRef = useRef(1.0);
  const drawFrameRef = useRef<number>(0);
  const needsRedrawRef = useRef(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [, forceUpdate] = useState(0);

  // Build graph data from props
  const graphNodes = useMemo(() => {
    const nodes: GraphNode[] = [];
    const cx = 400;
    const cy = 300;
    const existingIds = new Set<string>();

    entities.forEach((entity, i) => {
      existingIds.add(entity.id);
      const angle = (2 * Math.PI * i) / Math.max(entities.length, 1);
      const radius = 150 + Math.random() * 100;
      nodes.push({
        id: entity.id,
        label: entity.name,
        type: 'entity',
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        isSpeaker: entity.is_speaker,
      });
    });

    categories.forEach((cat, i) => {
      existingIds.add(cat.id);
      const angle = (2 * Math.PI * i) / Math.max(categories.length, 1) + Math.PI / 4;
      const radius = 250 + Math.random() * 80;
      nodes.push({
        id: cat.id,
        label: cat.name,
        type: 'category',
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        layer: cat.layer,
      });
    });

    // Add placeholder nodes for edge endpoints not in the entity/category lists
    // This fixes the "all scopes" bug where paginated entities miss some edge endpoints
    const missingIds = new Set<string>();
    for (const edge of edges) {
      if (!existingIds.has(edge.source_entity_id)) missingIds.add(edge.source_entity_id);
      if (!existingIds.has(edge.target_entity_id)) missingIds.add(edge.target_entity_id);
    }
    let missingIdx = 0;
    for (const id of missingIds) {
      existingIds.add(id);
      const angle = (2 * Math.PI * missingIdx) / Math.max(missingIds.size, 1) + Math.PI / 6;
      const radius = 180 + Math.random() * 120;
      nodes.push({
        id,
        label: id.slice(0, 8),
        type: 'entity',
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        isSpeaker: false,
      });
      missingIdx++;
    }

    return nodes;
  }, [entities, categories, edges]);

  const graphEdges = useMemo(() => {
    return edges.map((edge) => ({
      source: edge.source_entity_id,
      target: edge.target_entity_id,
      label: truncateText(edge.fact, 30),
      invalid: !!edge.invalid_at,
    }));
  }, [edges]);

  // Build node index for O(1) lookup
  const nodeIndexRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const idx = new Map<string, number>();
    graphNodes.forEach((n, i) => idx.set(n.id, i));
    nodeIndexRef.current = idx;
  }, [graphNodes]);

  // Force simulation with convergence detection
  useEffect(() => {
    nodesRef.current = graphNodes.map((n) => ({ ...n }));
    alphaRef.current = 1.0;
    let running = true;

    const simulate = () => {
      if (!running) return;
      const nodes = nodesRef.current;
      if (nodes.length === 0) {
        animFrameRef.current = requestAnimationFrame(simulate);
        return;
      }

      const alpha = alphaRef.current;

      // Only run physics when alpha is above threshold
      if (alpha > 0.001) {
        // Repulsion between all nodes (O(n²))
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const distSq = dx * dx + dy * dy;
            const dist = Math.sqrt(distSq) || 1;
            const force = 8000 / (distSq || 1);
            const fx = (dx / dist) * force * alpha;
            const fy = (dy / dist) * force * alpha;
            nodes[i].vx -= fx;
            nodes[i].vy -= fy;
            nodes[j].vx += fx;
            nodes[j].vy += fy;
          }
        }

        // Attraction along edges (O(E) with index lookup)
        const idx = nodeIndexRef.current;
        for (const edge of graphEdges) {
          const si = idx.get(edge.source);
          const ti = idx.get(edge.target);
          if (si === undefined || ti === undefined) continue;
          const source = nodes[si];
          const target = nodes[ti];
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (dist - 120) * 0.01 * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          source.vx += fx;
          source.vy += fy;
          target.vx -= fx;
          target.vy -= fy;
        }

        // Center gravity
        for (const node of nodes) {
          node.vx += (400 - node.x) * 0.001 * alpha;
          node.vy += (300 - node.y) * 0.001 * alpha;
        }

        // Apply velocity with damping
        for (const node of nodes) {
          node.vx *= 0.6;
          node.vy *= 0.6;
          node.x += node.vx;
          node.y += node.vy;
        }

        // Decay alpha
        alphaRef.current *= 0.995;
        needsRedrawRef.current = true;
      }

      animFrameRef.current = requestAnimationFrame(simulate);
    };

    simulate();
    return () => {
      running = false;
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [graphNodes, graphEdges]);

  // Separate draw loop - only redraws when needed
  useEffect(() => {
    const drawLoop = () => {
      if (needsRedrawRef.current) {
        needsRedrawRef.current = false;
        drawGraph();
      }
      drawFrameRef.current = requestAnimationFrame(drawLoop);
    };
    drawFrameRef.current = requestAnimationFrame(drawLoop);
    return () => cancelAnimationFrame(drawFrameRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme-aware color palette
  const colors = useMemo(() => {
    if (isDark) {
      return {
        edgeNormal: 'rgba(148, 163, 184, 0.3)',
        edgeInvalid: 'rgba(239, 68, 68, 0.4)',
        edgeLabel: 'rgba(203, 213, 225, 0.85)',
        nodeLabel: 'rgba(226, 232, 240, 0.95)',
        nodeLabelHover: 'rgba(248, 250, 252, 1)',
        // Speaker node
        speakerFill: 'rgba(59, 130, 246, 0.2)',
        speakerFillHover: 'rgba(59, 130, 246, 0.35)',
        speakerStroke: 'rgba(96, 165, 250, 0.7)',
        speakerStrokeHover: 'rgba(96, 165, 250, 1)',
        speakerGlow: 'rgba(59, 130, 246, 0.15)',
        // Entity node
        entityFill: 'rgba(99, 102, 241, 0.15)',
        entityFillHover: 'rgba(99, 102, 241, 0.3)',
        entityStroke: 'rgba(129, 140, 248, 0.6)',
        entityStrokeHover: 'rgba(129, 140, 248, 1)',
        entityGlow: 'rgba(99, 102, 241, 0.15)',
        // Category node
        catFill: 'rgba(139, 92, 246, 0.18)',
        catFillHover: 'rgba(139, 92, 246, 0.35)',
        catStroke: 'rgba(167, 139, 250, 0.65)',
        catStrokeHover: 'rgba(167, 139, 250, 1)',
        catGlow: 'rgba(139, 92, 246, 0.15)',
      };
    }
    return {
      edgeNormal: 'rgba(100, 116, 139, 0.35)',
      edgeInvalid: 'rgba(239, 68, 68, 0.3)',
      edgeLabel: 'rgba(71, 85, 105, 0.8)',
      nodeLabel: 'rgba(30, 41, 59, 0.9)',
      nodeLabelHover: 'rgba(15, 23, 42, 0.95)',
      // Speaker node
      speakerFill: 'rgba(59, 130, 246, 0.12)',
      speakerFillHover: 'rgba(59, 130, 246, 0.25)',
      speakerStroke: 'rgba(59, 130, 246, 0.6)',
      speakerStrokeHover: 'rgba(59, 130, 246, 0.9)',
      speakerGlow: 'rgba(59, 130, 246, 0.12)',
      // Entity node
      entityFill: 'rgba(99, 102, 241, 0.1)',
      entityFillHover: 'rgba(99, 102, 241, 0.25)',
      entityStroke: 'rgba(99, 102, 241, 0.5)',
      entityStrokeHover: 'rgba(99, 102, 241, 0.9)',
      entityGlow: 'rgba(99, 102, 241, 0.12)',
      // Category node
      catFill: 'rgba(139, 92, 246, 0.12)',
      catFillHover: 'rgba(139, 92, 246, 0.25)',
      catStroke: 'rgba(139, 92, 246, 0.6)',
      catStrokeHover: 'rgba(139, 92, 246, 0.9)',
      catGlow: 'rgba(139, 92, 246, 0.12)',
    };
  }, [isDark]);

  // Build adjacency map for hover highlighting
  const adjacencyMap = useMemo(() => {
    const adj = new Map<string, Set<string>>();
    for (const edge of graphEdges) {
      if (!adj.has(edge.source)) adj.set(edge.source, new Set());
      if (!adj.has(edge.target)) adj.set(edge.target, new Set());
      adj.get(edge.source)!.add(edge.target);
      adj.get(edge.target)!.add(edge.source);
    }
    return adj;
  }, [graphEdges]);

  // The actual draw function
  const drawGraph = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, rect.width, rect.height);
    ctx.save();
    ctx.translate(offsetRef.current.x, offsetRef.current.y);
    ctx.scale(zoomRef.current, zoomRef.current);

    const nodes = nodesRef.current;
    const hoveredNode = hoveredNodeRef.current;
    const c = colors;

    // Compute highlighted node set when hovering
    let highlightedNodes: Set<string> | null = null;
    if (hoveredNode) {
      highlightedNodes = new Set<string>([hoveredNode]);
      const neighbors = adjacencyMap.get(hoveredNode);
      if (neighbors) {
        for (const n of neighbors) highlightedNodes.add(n);
      }
    }

    // Helper: get dim factor for a node (0 = fully dimmed, 1 = normal/bright)
    const getNodeAlpha = (nodeId: string): number => {
      if (!highlightedNodes) return 1;
      return highlightedNodes.has(nodeId) ? 1 : 0.15;
    };

    // Helper: get dim factor for an edge
    const getEdgeAlpha = (sourceId: string, targetId: string): number => {
      if (!highlightedNodes) return 1;
      // Edge is highlighted if both endpoints are highlighted
      if (highlightedNodes.has(sourceId) && highlightedNodes.has(targetId)) return 1;
      return 0.08;
    };

    // Draw edges
    // Track label positions to avoid overlap
    const labelPositions: { x: number; y: number; w: number; h: number }[] = [];

    for (const edge of graphEdges) {
      const si = nodeIndexRef.current.get(edge.source);
      const ti = nodeIndexRef.current.get(edge.target);
      if (si === undefined || ti === undefined) continue;
      const source = nodes[si];
      const target = nodes[ti];

      const edgeAlpha = getEdgeAlpha(edge.source, edge.target);

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      if (edgeAlpha < 1) {
        ctx.globalAlpha = edgeAlpha;
        ctx.strokeStyle = edge.invalid ? c.edgeInvalid : c.edgeNormal;
      } else {
        ctx.globalAlpha = 1;
        // Highlighted edges: brighter color and thicker
        ctx.strokeStyle = edge.invalid ? c.edgeInvalid : (isDark ? 'rgba(148, 163, 184, 0.7)' : 'rgba(100, 116, 139, 0.7)');
      }
      ctx.lineWidth = edgeAlpha < 1 ? (edge.invalid ? 1 : 1.5) : (edge.invalid ? 1.5 : 2.5);
      if (edge.invalid) ctx.setLineDash([4, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;

      // Edge label - only show when zoomed in enough and edge is visible
      if (zoomRef.current > 0.6 && edgeAlpha > 0.5) {
        const mx = (source.x + target.x) / 2;
        const my = (source.y + target.y) / 2;

        // Measure text width for collision detection
        ctx.font = '10px system-ui';
        const textWidth = ctx.measureText(edge.label).width;
        const textHeight = 12;
        const padding = 4;
        const labelW = textWidth + padding * 2;
        const labelH = textHeight + padding;

        // Find a non-overlapping position
        let labelX = mx;
        let labelY = my - 8;
        let offsetStep = 0;
        const maxSteps = 8;

        while (offsetStep < maxSteps) {
          const candidateX = labelX;
          const candidateY = labelY - offsetStep * 14;
          const candidateRect = {
            x: candidateX - labelW / 2,
            y: candidateY - labelH / 2,
            w: labelW,
            h: labelH,
          };

          let overlaps = false;
          for (const existing of labelPositions) {
            if (
              candidateRect.x < existing.x + existing.w &&
              candidateRect.x + candidateRect.w > existing.x &&
              candidateRect.y < existing.y + existing.h &&
              candidateRect.y + candidateRect.h > existing.y
            ) {
              overlaps = true;
              break;
            }
          }

          if (!overlaps) {
            labelX = candidateX;
            labelY = candidateY;
            labelPositions.push(candidateRect);
            break;
          }
          offsetStep++;
        }

        // Draw label with background for readability
        if (offsetStep < maxSteps) {
          const bgX = labelX - labelW / 2;
          const bgY = labelY - labelH / 2;
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.75)' : 'rgba(255, 255, 255, 0.75)';
          ctx.beginPath();
          ctx.roundRect(bgX, bgY, labelW, labelH, 3);
          ctx.fill();
          ctx.fillStyle = c.edgeLabel;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(edge.label, labelX, labelY);
        }
      }
    }

    // Draw nodes
    for (const node of nodes) {
      const isHovered = hoveredNode === node.id;
      const nodeAlpha = getNodeAlpha(node.id);
      const nodeRadius = node.type === 'category' ? 24 : (node.isSpeaker ? 20 : 16);

      ctx.globalAlpha = nodeAlpha;

      // Category: draw as rounded rect
      if (node.type === 'category') {
        const w = nodeRadius * 2.2;
        const h = nodeRadius * 1.4;
        const rx = 6;

        // Glow on hover
        if (isHovered) {
          ctx.beginPath();
          ctx.roundRect(node.x - w / 2 - 4, node.y - h / 2 - 4, w + 8, h + 8, rx + 2);
          ctx.fillStyle = c.catGlow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.roundRect(node.x - w / 2, node.y - h / 2, w, h, rx);
        ctx.fillStyle = isHovered ? c.catFillHover : c.catFill;
        ctx.strokeStyle = isHovered ? c.catStrokeHover : c.catStroke;
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();
      } else {
        // Entity: draw as circle
        // Glow on hover
        if (isHovered) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, nodeRadius + 6, 0, Math.PI * 2);
          ctx.fillStyle = node.isSpeaker ? c.speakerGlow : c.entityGlow;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        if (node.isSpeaker) {
          ctx.fillStyle = isHovered ? c.speakerFillHover : c.speakerFill;
          ctx.strokeStyle = isHovered ? c.speakerStrokeHover : c.speakerStroke;
        } else {
          ctx.fillStyle = isHovered ? c.entityFillHover : c.entityFill;
          ctx.strokeStyle = isHovered ? c.entityStrokeHover : c.entityStroke;
        }
        ctx.lineWidth = isHovered ? 2.5 : 1.5;
        ctx.fill();
        ctx.stroke();
      }

      // Label - theme-aware high contrast text
      ctx.font = `${isHovered ? 'bold ' : ''}12px system-ui`;
      ctx.fillStyle = isHovered ? c.nodeLabelHover : c.nodeLabel;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(truncateText(node.label, 12), node.x, node.y);

      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [graphEdges, colors, isDark, adjacencyMap]);

  // Wheel zoom handler - use useEffect with { passive: false } to avoid passive event listener error
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.min(Math.max(zoomRef.current * delta, 0.1), 5);
      const scaleChange = newZoom / zoomRef.current;
      offsetRef.current = {
        x: mouseX - (mouseX - offsetRef.current.x) * scaleChange,
        y: mouseY - (mouseY - offsetRef.current.y) * scaleChange,
      };
      zoomRef.current = newZoom;
      needsRedrawRef.current = true;
      forceUpdate((v) => v + 1);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, []);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current;

    const nodes = nodesRef.current;
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const r = node.type === 'category' ? 26 : (node.isSpeaker ? 22 : 18);
      if (dx * dx + dy * dy < r * r) {
        onNodeClick(node.type, node.id);
        return;
      }
    }
  }, [onNodeClick]);

  const handleCanvasMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current) {
      offsetRef.current = {
        x: offsetRef.current.x + e.clientX - dragStartRef.current.x,
        y: offsetRef.current.y + e.clientY - dragStartRef.current.y,
      };
      dragStartRef.current = { x: e.clientX, y: e.clientY };
      needsRedrawRef.current = true;
      forceUpdate((v) => v + 1);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetRef.current.x) / zoomRef.current;
    const y = (e.clientY - rect.top - offsetRef.current.y) / zoomRef.current;

    const nodes = nodesRef.current;
    let found = false;
    for (const node of nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      const r = node.type === 'category' ? 26 : (node.isSpeaker ? 22 : 18);
      if (dx * dx + dy * dy < r * r) {
        if (hoveredNodeRef.current !== node.id) {
          hoveredNodeRef.current = node.id;
          needsRedrawRef.current = true;
        }
        canvas.style.cursor = 'pointer';
        found = true;
        break;
      }
    }
    if (!found) {
      if (hoveredNodeRef.current !== null) {
        hoveredNodeRef.current = null;
        needsRedrawRef.current = true;
      }
      canvas.style.cursor = isDraggingRef.current ? 'grabbing' : 'grab';
    }
  }, []);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true);
        needsRedrawRef.current = true;
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        needsRedrawRef.current = true;
      }).catch(() => {});
    }
  }, []);

  // Listen for fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      needsRedrawRef.current = true;
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Touch event handlers for mobile drag
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      isDraggingRef.current = true;
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isDraggingRef.current && e.touches.length === 1) {
      e.preventDefault();
      offsetRef.current = {
        x: offsetRef.current.x + e.touches[0].clientX - dragStartRef.current.x,
        y: offsetRef.current.y + e.touches[0].clientY - dragStartRef.current.y,
      };
      dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      needsRedrawRef.current = true;
      forceUpdate((v) => v + 1);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full',
        isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''
      )}
      style={isFullscreen ? { height: '100vh' } : { height: 'calc(100vh - 280px)', minHeight: 400 }}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          'w-full h-full',
          isFullscreen ? '' : 'rounded-lg',
          isGlass ? 'glass-card' : 'border border-border/50'
        )}
        style={{ cursor: 'grab', touchAction: 'none' }}
        onClick={handleCanvasClick}
        onMouseMove={handleCanvasMove}
        onMouseDown={(e) => {
          isDraggingRef.current = true;
          dragStartRef.current = { x: e.clientX, y: e.clientY };
        }}
        onMouseUp={() => { isDraggingRef.current = false; }}
        onMouseLeave={() => { isDraggingRef.current = false; hoveredNodeRef.current = null; needsRedrawRef.current = true; }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      {/* Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1">
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => { zoomRef.current = Math.min(zoomRef.current * 1.2, 5); needsRedrawRef.current = true; forceUpdate((v) => v + 1); }}>
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={() => { zoomRef.current = Math.max(zoomRef.current / 1.2, 0.1); needsRedrawRef.current = true; forceUpdate((v) => v + 1); }}>
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8 bg-background/80 backdrop-blur" onClick={toggleFullscreen}>
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-4 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded-md px-3 py-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-blue-400/60 bg-blue-400/10" />
          {useLanguage().t('aiMemory.legendSpeaker')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full border border-indigo-400/60 bg-indigo-400/10" />
          {useLanguage().t('aiMemory.legendEntity')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3.5 h-2.5 rounded border border-violet-400/60 bg-violet-400/10" />
          {useLanguage().t('aiMemory.legendCategory')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0 border-t border-dashed border-red-400/60" />
          {useLanguage().t('aiMemory.legendInvalid')}
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
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-xl font-bold">{value.toLocaleString()}</p>
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

function EntityNode({ entity, isGlass, onClick }: { entity: Entity; isGlass: boolean; onClick: () => void }) {
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
        {entity.tag.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entity.tag.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
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
  // Group categories by layer
  const layerGroups = useMemo(() => {
    const groups = new Map<number, Category[]>();
    for (const cat of categories) {
      const list = groups.get(cat.layer) || [];
      list.push(cat);
      groups.set(cat.layer, list);
    }
    // Sort layers ascending
    return new Map([...groups.entries()].sort(([a], [b]) => a - b));
  }, [categories]);

  const maxLayer = categories.length > 0 ? Math.max(...categories.map(c => c.layer)) : 0;

  // Layer color palette - gradient from root to leaf
  const getLayerColor = (layer: number) => {
    const colors = [
      { bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.5)', text: 'text-violet-600 dark:text-violet-400', accent: 'bg-violet-500' },
      { bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.5)', text: 'text-blue-600 dark:text-blue-400', accent: 'bg-blue-500' },
      { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.5)', text: 'text-emerald-600 dark:text-emerald-400', accent: 'bg-emerald-500' },
      { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.5)', text: 'text-amber-600 dark:text-amber-400', accent: 'bg-amber-500' },
      { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.5)', text: 'text-red-600 dark:text-red-400', accent: 'bg-red-500' },
      { bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.5)', text: 'text-pink-600 dark:text-pink-400', accent: 'bg-pink-500' },
    ];
    return colors[layer % colors.length];
  };

  if (categories.length === 0) return null;

  return (
    <div className="space-y-1">
      {/* Layer header legend */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {Array.from(layerGroups.entries()).map(([layer, cats]) => {
          const color = getLayerColor(layer);
          return (
            <div key={layer} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('w-2.5 h-2.5 rounded-sm', color.accent)} />
              <span>Layer {layer}</span>
              <span className="text-muted-foreground/60">({cats.length})</span>
            </div>
          );
        })}
      </div>

      {/* Tree structure */}
      <div className={cn('rounded-lg p-4', isGlass ? 'glass-card' : 'border border-border/50 bg-background/50')}>
        {Array.from(layerGroups.entries()).map(([layer, cats], groupIdx) => {
          const color = getLayerColor(layer);
          const isLastGroup = groupIdx === layerGroups.size - 1;

          return (
            <div key={layer} className="relative">
              {/* Vertical connector line from parent layer */}
              {groupIdx > 0 && (
                <div className="absolute left-5 -top-3 w-px h-3 bg-border/50" />
              )}

              {/* Layer label row */}
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-10 h-6 rounded flex items-center justify-center text-xs font-semibold text-white', color.accent)}>
                  L{layer}
                </div>
                <div className="flex-1 h-px bg-border/30" />
                <span className="text-xs text-muted-foreground">{cats.length} 项</span>
              </div>

              {/* Category items in this layer */}
              <div className="ml-5 pl-4 border-l-2 border-border/20 space-y-1.5 mb-3">
                {cats.map((cat) => (
                  <div
                    key={cat.id}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-all',
                      'hover:shadow-sm hover:bg-accent/50',
                      isGlass ? 'hover:bg-accent/30' : 'hover:bg-accent/50'
                    )}
                    onClick={() => onClick(cat.id)}
                  >
                    {/* Node connector dot */}
                    <div className="relative flex items-center justify-center -ml-[21px] w-4">
                      <div className="w-2 h-2 rounded-full border-2 bg-background" style={{ borderColor: color.border }} />
                    </div>

                    {/* Category info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                        <span className="font-medium text-sm truncate">{cat.name}</span>
                      </div>
                      {cat.summary && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 ml-5.5">{cat.summary}</p>
                      )}
                    </div>

                    {/* Stats badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {cat.child_categories_count > 0 && (
                        <Badge variant="outline" className="text-xs h-5 px-1.5">
                          <Layers className="w-3 h-3 mr-0.5" />{cat.child_categories_count}
                        </Badge>
                      )}
                      {cat.member_entities_count > 0 && (
                        <Badge variant="outline" className="text-xs h-5 px-1.5">
                          <Brain className="w-3 h-3 mr-0.5" />{cat.member_entities_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Vertical connector line to child layer */}
              {!isLastGroup && (
                <div className="absolute left-5 bottom-0 w-px h-3 bg-border/50" />
              )}
            </div>
          );
        })}
      </div>
    </div>
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'episode' | 'entity' | 'edge' | 'category'>('episode');

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
        if (scopesData) setScopes(scopesData);
        if (hierData) setHierGraphStatus(hierData);
        if (configData) setConfig(configData);
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

  useEffect(() => {
    if (!isLoading) {
      fetchEpisodes(1);
      fetchEntities(1);
      fetchEdges(1);
      fetchCategories(1);
    }
  }, [isLoading]);

  const handleScopeChange = (scope: string) => {
    setSelectedScope(scope);
    setEpisodePage(1); setEntityPage(1); setEdgePage(1); setCategoryPage(1);
    // Pass scope explicitly to avoid stale closure
    fetchEpisodes(1, scope);
    fetchEntities(1, scope);
    fetchEdges(1, scope);
    fetchCategories(1, scope);
  };

  const handleDeleteScope = async (scopeKey: string) => {
    if (!confirm(t('aiMemory.confirmDeleteScope'))) return;
    try {
      await memoryApi.deleteScope(scopeKey);
      toast.success(t('aiMemory.scopeDeleted'));
      const scopesData = await memoryApi.getScopes();
      setScopes(scopesData);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch { toast.error(t('aiMemory.deleteScopeFailed')); }
  };

  const handleDeleteEpisode = async (episodeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEpisode'))) return;
    try {
      await memoryApi.deleteEpisode(episodeId);
      toast.success(t('aiMemory.episodeDeleted'));
      fetchEpisodes(episodePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch { toast.error(t('aiMemory.deleteFailed')); }
  };

  const handleDeleteEntity = async (entityId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEntity'))) return;
    try {
      await memoryApi.deleteEntity(entityId);
      toast.success(t('aiMemory.entityDeleted'));
      fetchEntities(entityPage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch { toast.error(t('aiMemory.deleteFailed')); }
  };

  const handleDeleteEdge = async (edgeId: string) => {
    if (!confirm(t('aiMemory.confirmDeleteEdge'))) return;
    try {
      await memoryApi.deleteEdge(edgeId);
      toast.success(t('aiMemory.edgeDeleted'));
      fetchEdges(edgePage);
      const statsData = await memoryApi.getStats();
      if (statsData) setStats(statsData);
    } catch { toast.error(t('aiMemory.deleteFailed')); }
  };

  const openDetailDialog = async (type: 'episode' | 'entity' | 'edge' | 'category', id: string) => {
    setDialogType(type);
    setDialogOpen(true);
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

  if (isLoading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3"><Brain className="w-8 h-8" />{t('aiMemory.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('aiMemory.description')}</p>
      </div>

      {error && (
        <Card className={cn('border-destructive/50', isGlass ? 'glass-card' : 'border border-border/50')}>
          <CardContent className="flex items-center gap-3 p-4 text-destructive">
            <AlertCircle className="w-5 h-5" /><span>{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Stats - Unified color scheme */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
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

      {/* Tabs */}
      <TabButtonGroup
        value={activeTab}
        onValueChange={setActiveTab}
        options={[
          { value: 'graph', label: t('aiMemory.tabGraph'), icon: <Network className="w-4 h-4" /> },
          { value: 'scopes', label: t('aiMemory.tabScopes'), icon: <Globe className="w-4 h-4" /> },
          { value: 'episodes', label: t('aiMemory.tabEpisodes'), icon: <MessageSquare className="w-4 h-4" /> },
          { value: 'entities', label: t('aiMemory.tabEntities'), icon: <Brain className="w-4 h-4" /> },
          { value: 'edges', label: t('aiMemory.tabEdges'), icon: <GitBranch className="w-4 h-4" /> },
          { value: 'categories', label: t('aiMemory.tabCategories'), icon: <FolderTree className="w-4 h-4" /> },
          { value: 'config', label: t('aiMemory.tabConfig'), icon: <Settings className="w-4 h-4" /> },
        ]}
      />

      {/* Knowledge Graph Tab */}
      {activeTab === 'graph' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.graphDescription')}</p>
            <div className="flex gap-2">
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.allScopes')}</SelectItem>
                  {scopes.map((s) => <SelectItem key={s.scope_key} value={s.scope_key}>{s.scope_key}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { fetchEntities(1); fetchEdges(1); fetchCategories(1); }}>
                <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
              </Button>
            </div>
          </div>
          {entities.length === 0 && edges.length === 0 && categories.length === 0 ? (
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

      {/* Scopes Tab */}
      {activeTab === 'scopes' && (
      <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <p className="text-sm text-muted-foreground">{t('aiMemory.scopeCount', { count: scopes.length })}</p>
            <Button variant="outline" size="sm" onClick={async () => { const data = await memoryApi.getScopes(); setScopes(data); }}>
              <RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.allScopes')}</SelectItem>
                  {scopes.map((s) => <SelectItem key={s.scope_key} value={s.scope_key}>{s.scope_key}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.allScopes')}</SelectItem>
                  {scopes.map((s) => <SelectItem key={s.scope_key} value={s.scope_key}>{s.scope_key}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => { setEntityFilterSpeaker(entityFilterSpeaker === undefined ? true : entityFilterSpeaker === true ? false : undefined); fetchEntities(1); }}>
                <Users className="w-4 h-4 mr-1" />
                {entityFilterSpeaker === true ? t('aiMemory.speakersOnly') : entityFilterSpeaker === false ? t('aiMemory.nonSpeakersOnly') : t('aiMemory.allUsers')}
              </Button>
              <Button variant="outline" size="sm" onClick={() => fetchEntities(entityPage)}><RefreshCw className="w-4 h-4 mr-1" />{t('common.refresh')}</Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">{t('aiMemory.entityCount', { count: entities.length, total: totalEntities })}</p>
          {isLoadingData ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : entities.length === 0 ? (
            <Card className={cn(isGlass ? 'glass-card' : 'border border-border/50')}>
              <CardContent className="flex flex-col items-center justify-center p-8 text-muted-foreground"><Brain className="w-12 h-12 mb-4 opacity-50" /><p>{t('aiMemory.noEntities')}</p></CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {entities.map((entity) => (
                <div key={entity.id} className="relative group">
                  <EntityNode entity={entity} isGlass={isGlass} onClick={() => openDetailDialog('entity', entity.id)} />
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
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.allScopes')}</SelectItem>
                  {scopes.map((s) => <SelectItem key={s.scope_key} value={s.scope_key}>{s.scope_key}</SelectItem>)}
                </SelectContent>
              </Select>
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
              <Select value={selectedScope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('aiMemory.allScopes')}</SelectItem>
                  {scopes.map((s) => <SelectItem key={s.scope_key} value={s.scope_key}>{s.scope_key}</SelectItem>)}
                </SelectContent>
              </Select>
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
          {totalCategories > 20 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={categoryPage <= 1} onClick={() => fetchCategories(categoryPage - 1)}>{t('common.previousPage')}</Button>
              <span className="flex items-center text-sm text-muted-foreground">{categoryPage} / {Math.ceil(totalCategories / 20)}</span>
              <Button variant="outline" size="sm" disabled={categoryPage >= Math.ceil(totalCategories / 20)} onClick={() => fetchCategories(categoryPage + 1)}>{t('common.nextPage')}</Button>
            </div>
          )}
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

      {/* Detail Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialogType === 'episode' && t('aiMemory.episodeDetail')}
              {dialogType === 'entity' && t('aiMemory.entityDetail')}
              {dialogType === 'edge' && t('aiMemory.edgeDetail')}
              {dialogType === 'category' && t('aiMemory.categoryDetail')}
            </DialogTitle>
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
              <div><Label className="text-muted-foreground">{t('aiMemory.scopeKey')}</Label><p className="font-mono text-sm">{selectedEntity.scope_key}</p></div>
              <div><Label className="text-muted-foreground">{t('aiMemory.name')}</Label><p className="font-medium">{selectedEntity.name}</p></div>
              {selectedEntity.summary && <div><Label className="text-muted-foreground">{t('aiMemory.summary')}</Label><p className="mt-1 p-2 bg-muted/50 rounded text-sm">{selectedEntity.summary}</p></div>}
              {selectedEntity.tag.length > 0 && <div><Label className="text-muted-foreground">{t('aiMemory.tags')}</Label><div className="flex flex-wrap gap-2 mt-2">{selectedEntity.tag.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div></div>}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.isSpeaker')}</Label><p>{selectedEntity.is_speaker ? t('common.yes') : t('common.no')}</p></div>
                {selectedEntity.user_id && <div><Label className="text-muted-foreground">{t('aiMemory.userId')}</Label><p className="font-mono">{selectedEntity.user_id}</p></div>}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">{t('aiMemory.createdAt')}</Label><p>{formatDate(selectedEntity.created_at)}</p></div>
                <div><Label className="text-muted-foreground">{t('aiMemory.updatedAt')}</Label><p>{formatDate(selectedEntity.updated_at)}</p></div>
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
    </div>
  );
}
