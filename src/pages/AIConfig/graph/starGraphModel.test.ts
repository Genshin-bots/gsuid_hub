import { describe, expect, it } from 'vitest';
import type { AITaskKindInfo, AITaskModelsData } from '@/lib/api';
import {
  computeSatelliteRadius,
  computeStarGraphLayout,
  findUnconfiguredConnectedHubIds,
  materializeGraphPositions,
  MAX_SATELLITE_RADIUS,
  MIN_SATELLITE_RADIUS,
  rearrangeGraphPositions,
  synthesizeGraphFromTaskModels,
} from './starGraphModel';

function makeKind(
  id: string,
  level: 'high' | 'low',
  extra: Partial<AITaskKindInfo> = {},
): AITaskKindInfo {
  return {
    id,
    title: id,
    desc: '',
    group: 'conversation',
    default_level: level,
    follows_caller: false,
    fast: false,
    stats_keys: [id],
    override: null,
    effective: { primary: '', secondary: '', source: 'default', level },
    ...extra,
  };
}

describe('starGraphModel', () => {
  it('clamps satellite radius between min and max even when usage is 0 or extreme', () => {
    expect(computeSatelliteRadius(0, 0)).toBe(MIN_SATELLITE_RADIUS);
    expect(computeSatelliteRadius(0, 10_000_000)).toBe(MIN_SATELLITE_RADIUS);
    expect(computeSatelliteRadius(10_000_000, 10_000_000)).toBe(MAX_SATELLITE_RADIUS);
    const mid = computeSatelliteRadius(10_000, 10_000_000);
    expect(mid).toBeGreaterThan(MIN_SATELLITE_RADIUS);
    expect(mid).toBeLessThan(MAX_SATELLITE_RADIUS);
  });

  it('keeps two initial hubs when existing user has high === low (Option 4-A) and when new user is empty', () => {
    const sameModelData: AITaskModelsData = {
      groups: ['conversation'],
      levels: {
        high: { primary: 'openai++DeepSeek', secondary: '' },
        low: { primary: 'openai++DeepSeek', secondary: '' },
      },
      kinds: [makeKind('chat', 'high'), makeKind('turn_router', 'low')],
      orphans: [],
    };
    const sameGraph = synthesizeGraphFromTaskModels(sameModelData);
    expect(sameGraph.nodes).toHaveLength(2);
    expect(sameGraph.nodes[0].primary).toBe('openai++DeepSeek');
    expect(sameGraph.nodes[1].primary).toBe('openai++DeepSeek');
    expect(sameGraph.edges.chat).toBe('slot_high');
    expect(sameGraph.edges.turn_router).toBe('slot_low');

    const newUserData: AITaskModelsData = {
      groups: ['conversation'],
      levels: {
        high: { primary: '', secondary: '' },
        low: { primary: '', secondary: '' },
      },
      kinds: [makeKind('chat', 'high'), makeKind('turn_router', 'low')],
      orphans: [],
    };
    const newGraph = synthesizeGraphFromTaskModels(newUserData);
    expect(newGraph.nodes.map((n) => n.primary)).toEqual(['', '']);
    expect(findUnconfiguredConnectedHubIds(newGraph, newUserData.kinds)).toEqual([
      'slot_high',
      'slot_low',
    ]);
  });

  it('organizes low-frequency tasks and capability subagents under core parent nodes, expanding on click and keeping detached children visible', () => {
    const kinds: AITaskKindInfo[] = [
      makeKind('chat', 'high'),
      makeKind('temp_assistant', 'high'),
      makeKind('subagent', 'high', { group: 'agent' }),
      makeKind('build_persona', 'high', { group: 'agent' }),
      makeKind('mcp_profile', 'high', { group: 'agent' }),
      makeKind('capability_agent', 'high', { group: 'agent' }),
      makeKind('capability_agent:render_agent', 'high', {
        group: 'agent',
        parent_id: 'capability_agent',
      }),
      makeKind('capability_agent:code_agent', 'high', {
        group: 'agent',
        parent_id: 'capability_agent',
      }),
      makeKind('turn_router', 'low'),
      makeKind('eval_judge', 'low'),
      makeKind('image_understand', 'high', { group: 'multimodal', follows_caller: true }),
    ];

    const graph = {
      nodes: [
        {
          id: 'slot_high',
          primary: 'anthropic++Claude',
          secondary: '',
          role: 'high' as const,
          pos: null,
        },
        {
          id: 'slot_low',
          primary: 'openai++Flash',
          secondary: '',
          role: 'low' as const,
          pos: null,
        },
        {
          id: 'hub_custom',
          primary: 'openai++R1',
          secondary: '',
          role: 'custom' as const,
          pos: null,
        },
      ],
      edges: {
        chat: 'slot_high',
        temp_assistant: 'slot_high',
        subagent: 'slot_high',
        build_persona: 'slot_high',
        mcp_profile: 'hub_custom', // detached from subagent's hub -> stays visible even when collapsed!
        capability_agent: 'slot_high',
        turn_router: 'slot_low',
        eval_judge: 'slot_low',
      },
      split_subagents: [],
      task_positions: {},
    };

    // 1. Default collapsed state: no generic __folded__ ball; core parents hold childKinds; detached mcp_profile visible
    const collapsed = computeStarGraphLayout({
      graph,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
      expandedParentIds: new Set(),
    });

    const collapsedIds = collapsed.satellites.map((s) => s.id);
    expect(collapsedIds).not.toContain('image_understand');
    expect(collapsedIds.some((id) => id.startsWith('__folded__'))).toBe(false);
    expect(collapsedIds).toContain('chat');
    expect(collapsedIds).toContain('mcp_profile');
    expect(collapsedIds).not.toContain('temp_assistant');
    expect(collapsedIds).not.toContain('capability_agent:render_agent');

    const chatSat = collapsed.satellites.find((s) => s.id === 'chat');
    const capSat = collapsed.satellites.find((s) => s.id === 'capability_agent');
    expect(chatSat?.childKinds.map((k) => k.id)).toEqual(['temp_assistant']);
    expect(capSat?.childKinds.map((k) => k.id)).toEqual([
      'capability_agent:render_agent',
      'capability_agent:code_agent',
    ]);

    // 2. Clicking chat and capability_agent expands all their subordinate nodes on the graph
    const expanded = computeStarGraphLayout({
      graph,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
      expandedParentIds: new Set(['chat', 'capability_agent']),
    });
    const expandedIds = expanded.satellites.map((s) => s.id);
    expect(expandedIds).toContain('temp_assistant');
    expect(expandedIds).toContain('capability_agent:render_agent');
    expect(expandedIds).toContain('capability_agent:code_agent');

    const renderChild = expanded.satellites.find((s) => s.id === 'capability_agent:render_agent');
    expect(renderChild?.visualParentTaskId).toBe('capability_agent');
    expect(renderChild?.isDetachedChild).toBe(false);

    // 3. Even if stale task_positions exist for a non-detached child, expanding places it neatly beside its parent
    const staleGraph = {
      ...graph,
      task_positions: {
        temp_assistant: { x: 950, y: -900 },
      },
    };
    const expandedIgnoringStale = computeStarGraphLayout({
      graph: staleGraph,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
      expandedParentIds: new Set(['chat']),
    });
    const chatParent = expandedIgnoringStale.satellites.find((s) => s.id === 'chat');
    const tempChild = expandedIgnoringStale.satellites.find((s) => s.id === 'temp_assistant');
    expect(chatParent).toBeDefined();
    expect(tempChild).toBeDefined();
    const distFromParent = Math.hypot(
      (tempChild?.x ?? 0) - (chatParent?.x ?? 0),
      (tempChild?.y ?? 0) - (chatParent?.y ?? 0),
    );
    expect(distFromParent).toBeLessThan(200);
  });

  it('keeps satellite positions completely still when re-wiring edges and only moves on rearrangeGraphPositions', () => {
    const kinds: AITaskKindInfo[] = [
      makeKind('chat', 'high'),
      makeKind('autonomy', 'high', { group: 'agent' }),
      makeKind('turn_router', 'low'),
    ];
    const base = materializeGraphPositions({
      graph: synthesizeGraphFromTaskModels({
        groups: ['conversation', 'agent'],
        levels: {
          high: { primary: 'anthropic++Claude', secondary: '' },
          low: { primary: 'openai++Flash', secondary: '' },
        },
        kinds,
        orphans: [],
      }),
      kinds,
    });

    const beforeLayout = computeStarGraphLayout({
      graph: base,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
    });
    const autonomyBefore = beforeLayout.satellites.find((s) => s.id === 'autonomy');
    const chatBefore = beforeLayout.satellites.find((s) => s.id === 'chat');
    expect(autonomyBefore).toBeDefined();
    expect(chatBefore).toBeDefined();

    const rewired = {
      ...base,
      edges: {
        ...base.edges,
        autonomy: 'slot_low',
      },
    };
    const afterRewireLayout = computeStarGraphLayout({
      graph: rewired,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
    });
    const autonomyAfterRewire = afterRewireLayout.satellites.find((s) => s.id === 'autonomy');
    const chatAfterRewire = afterRewireLayout.satellites.find((s) => s.id === 'chat');
    expect(autonomyAfterRewire?.x).toBe(autonomyBefore?.x);
    expect(autonomyAfterRewire?.y).toBe(autonomyBefore?.y);
    expect(chatAfterRewire?.x).toBe(chatBefore?.x);
    expect(chatAfterRewire?.y).toBe(chatBefore?.y);

    const rearranged = rearrangeGraphPositions({ graph: rewired, kinds });
    const afterRearrangeLayout = computeStarGraphLayout({
      graph: rearranged,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
    });
    const autonomyRearranged = afterRearrangeLayout.satellites.find((s) => s.id === 'autonomy');
    expect(autonomyRearranged?.x).not.toBe(autonomyBefore?.x);
    expect((autonomyRearranged?.x ?? 0) > 0).toBe(true);
  });

  it('projects horizontal desktop hub layout into vertical mobile layout when isNarrow is true', () => {
    const kinds: AITaskKindInfo[] = [makeKind('chat', 'high'), makeKind('turn_router', 'low')];
    const desktopGraph = materializeGraphPositions({
      graph: synthesizeGraphFromTaskModels({
        groups: ['conversation'],
        levels: {
          high: { primary: 'anthropic++Claude', secondary: '' },
          low: { primary: 'openai++Flash', secondary: '' },
        },
        kinds,
        orphans: [],
      }),
      kinds,
      isNarrow: false,
    });

    const pcLayout = computeStarGraphLayout({
      graph: desktopGraph,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
      isNarrow: false,
    });
    expect(pcLayout.hubs[0].y).toBe(pcLayout.hubs[1].y);
    expect(pcLayout.hubs[0].x).toBeLessThan(pcLayout.hubs[1].x);

    const mobileLayout = computeStarGraphLayout({
      graph: desktopGraph,
      kinds,
      usageByStatKey: new Map(),
      metric: 'tokens',
      showAllLowFreq: false,
      isNarrow: true,
    });
    expect(mobileLayout.isOrientationProjected).toBe(true);
    expect(mobileLayout.hubs[0].x).toBe(0);
    expect(mobileLayout.hubs[1].x).toBe(0);
    expect(mobileLayout.hubs[0].y).toBeLessThan(mobileLayout.hubs[1].y);
  });
});
