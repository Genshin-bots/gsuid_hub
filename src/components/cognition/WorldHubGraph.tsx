import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import forceAtlas2 from 'graphology-layout-forceatlas2';
import FA2Layout from 'graphology-layout-forceatlas2/worker';
import { Loader2, Maximize2, Search, ZoomIn, ZoomOut } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import type { CognitionAttachment, CognitionNode } from '@/lib/api';
import { articleGraphId, worldGraphId } from '@/lib/cognition';
import { cn } from '@/lib/utils';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const CENTER_NODE_COUNT = 3;

type WorldNodeKind = 'hub' | 'article';

interface WorldNodeMeta {
  id: string;
  label: string;
  kind: WorldNodeKind;
  writable: boolean;
  degree: number;
  centerRank?: number;
}

function phyllotaxisPosition(index: number, spacing: number): { x: number; y: number } {
  const radius = spacing * Math.sqrt(index + 0.5);
  const angle = index * GOLDEN_ANGLE;
  return { x: radius * Math.cos(angle), y: radius * Math.sin(angle) };
}

function getPalette(isDark: boolean) {
  return isDark
    ? {
        hub: '#34d399',
        article: '#fbbf24',
        writable: '#38bdf8',
        center: '#facc15',
        edge: 'rgba(52,211,153,0.75)',
        nodeDim: 'rgba(100,116,139,0.18)',
        edgeDim: 'rgba(52,211,153,0.12)',
        label: '#e2e8f0',
        labelBg: 'rgba(15,23,42,0.78)',
      }
    : {
        hub: '#059669',
        article: '#d97706',
        writable: '#0284c7',
        center: '#f59e0b',
        edge: 'rgba(5,150,105,0.7)',
        nodeDim: 'rgba(148,163,184,0.22)',
        edgeDim: 'rgba(5,150,105,0.12)',
        label: '#1e293b',
        labelBg: 'rgba(255,255,255,0.82)',
      };
}

export function WorldHubGraph({
  hubs,
  isDark,
  onHubClick,
  onArticleClick,
}: {
  hubs: CognitionNode[];
  isDark: boolean;
  onHubClick: (hub: CognitionNode) => void;
  onArticleClick: (article: CognitionAttachment) => void;
}) {
  const { t } = useLanguage();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const fa2Ref = useRef<FA2Layout | null>(null);
  const isDarkRef = useRef(isDark);
  const hoveredRef = useRef<string | null>(null);
  const highlightRef = useRef<Set<string> | null>(null);
  const focusedRef = useRef<string | null>(null);
  const onHubClickRef = useRef(onHubClick);
  const onArticleClickRef = useRef(onArticleClick);
  isDarkRef.current = isDark;
  onHubClickRef.current = onHubClick;
  onArticleClickRef.current = onArticleClick;

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);

  const { nodeMeta, hubById, articleById, edges } = useMemo(() => {
    const hubById = new Map<string, CognitionNode>();
    const articleById = new Map<string, CognitionAttachment>();
    const degree = new Map<string, number>();
    const edges: Array<{ id: string; source: string; target: string; label: string }> = [];

    for (const hub of hubs) {
      const hid = worldGraphId(hub);
      hubById.set(hid, hub);
      const atts = hub.attachments ?? [];
      degree.set(hid, (degree.get(hid) || 0) + atts.length);
      for (const att of atts) {
        const aid = articleGraphId(att);
        articleById.set(aid, att);
        degree.set(aid, (degree.get(aid) || 0) + 1);
        edges.push({
          id: `att-edge:${hid}:${aid}`,
          source: hid,
          target: aid,
          label: att.slot || t('aiMemory.attachedArticles'),
        });
      }
    }

    const meta = new Map<string, WorldNodeMeta>();
    for (const [id, hub] of hubById) {
      const n = hub.attachments?.length ?? 0;
      meta.set(id, {
        id,
        label: n > 0 ? `${hub.title || hub.ref} (${n})` : (hub.title || hub.ref),
        kind: 'hub',
        writable: false,
        degree: degree.get(id) || 0,
      });
    }
    for (const [id, att] of articleById) {
      meta.set(id, {
        id,
        label: att.title || att.ref || id,
        kind: 'article',
        writable: !!att.writable,
        degree: degree.get(id) || 0,
      });
    }
    Array.from(meta.values())
      .filter((m) => m.kind === 'hub' && m.degree > 0)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, CENTER_NODE_COUNT)
      .forEach((m, i) => { m.centerRank = i + 1; });

    return { nodeMeta: meta, hubById, articleById, edges };
  }, [hubs, t]);

  const nodeSearchResults = useMemo(() => {
    const query = nodeSearchQuery.trim().toLowerCase();
    if (!query) return [];
    return Array.from(nodeMeta.values())
      .filter((m) => m.label.toLowerCase().includes(query) || m.id.toLowerCase().includes(query))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 8);
  }, [nodeMeta, nodeSearchQuery]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const graph = new Graph({ multi: true, type: 'directed' });
    let index = 0;
    nodeMeta.forEach((m) => {
      const pos = phyllotaxisPosition(index++, 24);
      const size = m.kind === 'hub'
        ? (m.centerRank ? 13 - m.centerRank : 7.5)
        : m.writable ? 5 : 4;
      graph.addNode(m.id, {
        x: pos.x,
        y: pos.y,
        size,
        label: m.label.length > 24 ? `${m.label.slice(0, 24)}...` : m.label,
        kind: m.kind,
        writable: m.writable,
        centerRank: m.centerRank ?? 0,
        degree: m.degree,
      });
    });
    for (const edge of edges) {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) continue;
      try {
        graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
          size: 1.2,
          label: edge.label,
        });
      } catch {
        // duplicate
      }
    }
    graphRef.current = graph;

    const drawNodeLabel = (context: CanvasRenderingContext2D, data: any, settings: any) => {
      if (!data.label) return;
      const palette = getPalette(isDarkRef.current);
      const fontSize = settings.labelSize as number;
      context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
      const textWidth = context.measureText(data.label).width;
      const boxW = textWidth + 10;
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

    const drawEdgeLabel = (
      context: CanvasRenderingContext2D,
      edgeData: any,
      sourceData: any,
      targetData: any,
      settings: any,
    ) => {
      if (!edgeData.label) return;
      const palette = getPalette(isDarkRef.current);
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
      labelColor: { color: getPalette(isDarkRef.current).label },
      labelRenderedSizeThreshold: 6,
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
      defaultNodeColor: getPalette(isDarkRef.current).hub,
      defaultEdgeColor: getPalette(isDarkRef.current).edge,
      nodeReducer: (node, data) => {
        const palette = getPalette(isDarkRef.current);
        const res = { ...data };
        let color = data.kind === 'hub'
          ? (data.centerRank ? palette.center : palette.hub)
          : data.writable ? palette.writable : palette.article;
        const highlight = highlightRef.current;
        if (highlight) {
          if (highlight.has(node)) res.forceLabel = true;
          else {
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
        const palette = getPalette(isDarkRef.current);
        const res = { ...data };
        let color = palette.edge;
        const highlight = highlightRef.current;
        const hovered = hoveredRef.current;
        if (highlight) {
          const [src, tgt] = graph.extremities(edge);
          if (src === hovered || tgt === hovered) res.forceLabel = true;
          else {
            res.label = '';
            if (!highlight.has(src) || !highlight.has(tgt)) color = palette.edgeDim;
          }
        } else {
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
      const kind = graph.getNodeAttribute(node, 'kind') as WorldNodeKind;
      if (kind === 'article') {
        const att = articleById.get(node);
        if (att) onArticleClickRef.current(att);
        return;
      }
      const hub = hubById.get(node);
      if (hub) onHubClickRef.current(hub);
    });

    let layoutTimer = 0;
    if (graph.order > 1) {
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
  }, [nodeMeta, edges, hubById, articleById]);

  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const palette = getPalette(isDark);
    renderer.setSetting('labelColor', { color: palette.label });
    renderer.setSetting('defaultNodeColor', palette.hub);
    renderer.setSetting('defaultEdgeColor', palette.edge);
    renderer.refresh({ skipIndexation: true });
  }, [isDark]);

  const stopLayout = useCallback(() => {
    if (fa2Ref.current) {
      fa2Ref.current.stop();
      setIsLayoutRunning(false);
    }
  }, []);

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
      renderer.getCamera().animate(
        { x: display.x, y: display.y, ratio: Math.min(renderer.getCamera().ratio, 0.22) },
        { duration: 600 },
      );
    }
    renderer.refresh({ skipIndexation: true });
  }, []);

  const toggleFullscreen = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

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
        className={cn('w-full h-full glass-card', isFullscreen ? '' : 'rounded-lg')}
        style={{ cursor: 'grab' }}
      />
      <form
        className="absolute top-3 left-3 w-[min(360px,calc(100%-88px))] rounded-lg border border-border/50 bg-background/90 p-2 shadow-sm backdrop-blur"
        onSubmit={(e) => {
          e.preventDefault();
          const first = nodeSearchResults[0];
          if (first) focusNode(first.id, { closeResults: true });
        }}
      >
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            value={nodeSearchQuery}
            onChange={(e) => setNodeSearchQuery(e.target.value)}
            placeholder={t('aiMemory.searchWorldHubs')}
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
                  <Badge variant={node.kind === 'hub' ? 'default' : 'outline'} className="shrink-0 text-[10px]">
                    {node.kind === 'hub' ? t('aiMemory.legendWorld') : t('aiMemory.legendArticle')}
                  </Badge>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('aiMemory.worldGraphNoMatch')}</div>
            )}
          </div>
        )}
      </form>
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
      {isLayoutRunning && (
        <button
          type="button"
          onClick={stopLayout}
          className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 rounded-md bg-background/85 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('aiMemory.graphLayoutRunning')}
        </button>
      )}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground bg-background/80 backdrop-blur rounded-md px-3 py-2">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-emerald-400/80" />
          {t('aiMemory.legendWorld')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-400/80" />
          {t('aiMemory.legendArticle')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-sky-400/80" />
          {t('aiMemory.articleWritable')}
        </span>
      </div>
    </div>
  );
}
