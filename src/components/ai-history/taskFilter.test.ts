import { describe, expect, it } from 'vitest';
import type { AITaskModelsData, SessionLogCategoriesResponse } from '@/lib/api';
import {
  DEFAULT_ALL_FILTER,
  DEFAULT_MAIN_CHAT_FILTER,
  buildTaskFilterModel,
  extractCapabilityNodeId,
  filterTaskSections,
  initialFilterFromSearchParams,
  parseTaskFilterValue,
  upgradeCreateByFilterToTaskKind,
  type TrFn,
} from './taskFilter';

const tr: TrFn = (_key, fallback) => fallback;

const SAMPLE_TASK_MODELS: AITaskModelsData = {
  groups: ['conversation', 'agent', 'memory'],
  levels: {
    high: { primary: 'openai++main', secondary: '' },
    low: { primary: 'openai++fast', secondary: '' },
  },
  orphans: [],
  kinds: [
    {
      id: 'chat',
      title: '主对话',
      desc: '群聊/私聊对话',
      group: 'conversation',
      default_level: 'high',
      follows_caller: false,
      fast: false,
      stats_keys: ['chat', 'http_chat'],
      override: null,
      effective: { primary: 'openai++main', secondary: '', source: 'default', level: 'high' },
      parent_id: null,
      node_source: null,
      plugin: null,
    },
    {
      id: 'capability_agent',
      title: '能力代理',
      desc: '能力代理汇总',
      group: 'agent',
      default_level: 'high',
      follows_caller: false,
      fast: false,
      stats_keys: ['capabilityagent'],
      override: null,
      effective: { primary: 'openai++main', secondary: '', source: 'default', level: 'high' },
      parent_id: null,
      node_source: null,
      plugin: null,
    },
    {
      id: 'capability_agent:render_agent',
      title: '视觉渲染',
      desc: '渲染图片卡片',
      group: 'agent',
      default_level: 'high',
      follows_caller: false,
      fast: false,
      stats_keys: ['capability_agent:render_agent'],
      override: null,
      effective: { primary: 'openai++main', secondary: '', source: 'default', level: 'high' },
      parent_id: 'capability_agent',
      node_source: 'builtin',
      plugin: 'core',
    },
    {
      id: 'capability_agent:demo_plugin_agent',
      title: '演示插件代理',
      desc: '插件能力代理',
      group: 'agent',
      default_level: 'high',
      follows_caller: false,
      fast: false,
      stats_keys: ['capability_agent:demo_plugin_agent'],
      override: null,
      effective: { primary: 'openai++main', secondary: '', source: 'default', level: 'high' },
      parent_id: 'capability_agent',
      node_source: 'plugin',
      plugin: 'DemoPlugin',
    },
    {
      id: 'autonomy',
      title: '自主行动',
      desc: '人格自主规划',
      group: 'agent',
      default_level: 'high',
      follows_caller: false,
      fast: false,
      stats_keys: ['autonomy'],
      override: null,
      effective: { primary: 'openai++main', secondary: '', source: 'default', level: 'high' },
      parent_id: null,
      node_source: null,
      plugin: null,
    },
    {
      id: 'memory_algebra',
      title: '记忆抽取',
      desc: '抽取记忆事实',
      group: 'memory',
      default_level: 'low',
      follows_caller: false,
      fast: true,
      stats_keys: ['memalgebra'],
      override: null,
      effective: { primary: 'openai++fast', secondary: '', source: 'default', level: 'low' },
      parent_id: null,
      node_source: null,
      plugin: null,
    },
  ],
};

const SAMPLE_CATEGORIES: SessionLogCategoriesResponse = {
  categories: [
    {
      create_by: 'CapabilityAgent',
      label: '能力 Agent',
      description: '',
      group: 'capability',
      count: 5,
      active_count: 1,
      subagent_count: 5,
    },
    {
      create_by: 'Proactive_heartbeat',
      label: '主动消息(heartbeat)',
      description: '',
      group: 'proactive',
      count: 2,
      active_count: 0,
      subagent_count: 0,
    },
  ],
  groups: { capability: 5, proactive: 2 },
  total: 2,
  task_kinds: {
    'capability_agent:render_agent': { count: 3, active_count: 1, subagent_count: 3 },
    'capability_agent:legacy_removed_node': { count: 2, active_count: 0, subagent_count: 2 },
    uninstalled_plugin_task: { count: 1, active_count: 0, subagent_count: 1 },
  },
  unmapped: [
    {
      create_by: 'Proactive_heartbeat',
      label: '主动消息(heartbeat)',
      description: '主动消息发送器触发的会话',
      group: 'proactive',
      count: 2,
      active_count: 0,
      subagent_count: 0,
    },
  ],
  personas: [{ persona_name: '测试人格A', count: 4, active_count: 1 }],
};

describe('ai-history taskFilter', () => {
  it('defaults to main chat and parses URL params cleanly', () => {
    expect(initialFilterFromSearchParams(new URLSearchParams())).toBe(DEFAULT_MAIN_CHAT_FILTER);
    expect(initialFilterFromSearchParams(new URLSearchParams('create_by=Chat'))).toBe(
      DEFAULT_MAIN_CHAT_FILTER,
    );
    expect(initialFilterFromSearchParams(new URLSearchParams('create_by=Autonomy'))).toBe(
      'cb:Autonomy',
    );
    expect(
      initialFilterFromSearchParams(new URLSearchParams('task_kind=capability_agent:render_agent')),
    ).toBe('task:capability_agent:render_agent');
    expect(initialFilterFromSearchParams(new URLSearchParams('create_by=__all__'))).toBe(
      DEFAULT_ALL_FILTER,
    );

    expect(upgradeCreateByFilterToTaskKind('cb:Autonomy', SAMPLE_TASK_MODELS.kinds)).toBe(
      'task:autonomy',
    );
    expect(
      upgradeCreateByFilterToTaskKind('cb:Proactive_heartbeat', SAMPLE_TASK_MODELS.kinds),
    ).toBe('cb:Proactive_heartbeat');
    expect(parseTaskFilterValue('task:capability_agent:render_agent')).toEqual({
      mode: 'task',
      taskKind: 'capability_agent:render_agent',
    });
    expect(parseTaskFilterValue('unmapped:Proactive_heartbeat')).toEqual({
      mode: 'unmapped',
      createBy: 'Proactive_heartbeat',
    });
    expect(parseTaskFilterValue('cb:Proactive_heartbeat')).toEqual({
      mode: 'create_by',
      createBy: 'Proactive_heartbeat',
    });
  });

  it('extracts capability node_id across all runtime suffixes without greedy truncation', () => {
    expect(extractCapabilityNodeId('capagent_render_agent_adhoc')).toBe('render_agent');
    expect(extractCapabilityNodeId('capagent_plugin_developer_agent_kanban_abc123_def456')).toBe(
      'plugin_developer_agent',
    );
    expect(extractCapabilityNodeId('capagent_research_agent_transient_99')).toBe('research_agent');
    expect(extractCapabilityNodeId('capagent_render_agent_present_ab12cd')).toBe('render_agent');
    expect(extractCapabilityNodeId('capagent_my_present_agent_adhoc')).toBe('my_present_agent');
    expect(extractCapabilityNodeId('capagent_ai_kanban_helper_adhoc')).toBe('ai_kanban_helper');
  });

  it('rolls up capability agent counts including orphan nodes and keeps unmapped sources', () => {
    const model = buildTaskFilterModel(SAMPLE_TASK_MODELS, SAMPLE_CATEGORIES, 7, tr);

    const capParent = model.optionByValue.get('task:capability_agent');
    expect(capParent?.count).toBe(5);
    expect(model.optionByValue.get('task:capability_agent:render_agent')?.count).toBe(3);
    expect(model.optionByValue.get('task:capability_agent:demo_plugin_agent')?.badge).toBe(
      'plugin · DemoPlugin',
    );
    const orphan = model.optionByValue.get('task:capability_agent:legacy_removed_node');
    expect(orphan?.count).toBe(2);
    expect(orphan?.isChild).toBe(true);
    expect(orphan?.badge).toBe('历史');

    const otherSec = model.sections.find((s) => s.id === 'other');
    expect(otherSec?.items.map((i) => i.value)).toEqual([
      'unmapped:Proactive_heartbeat',
      'task:uninstalled_plugin_task',
    ]);
  });

  it('hides zero-count categories by default except pinned chat and reveals them on search or toggle', () => {
    const model = buildTaskFilterModel(SAMPLE_TASK_MODELS, SAMPLE_CATEGORIES, 7, tr);

    const compact = filterTaskSections(model.sections, DEFAULT_MAIN_CHAT_FILTER, '', false);
    const compactValues = compact.sections.flatMap((s) => s.items.map((i) => i.value));
    expect(compactValues).toContain('task:chat');
    expect(compactValues).toContain('task:capability_agent');
    expect(compactValues).toContain('task:capability_agent:render_agent');
    expect(compactValues).toContain('task:capability_agent:legacy_removed_node');
    expect(compactValues).toContain('unmapped:Proactive_heartbeat');
    expect(compactValues).not.toContain('task:capability_agent:demo_plugin_agent');
    expect(compactValues).not.toContain('task:memory_algebra');
    expect(compact.hiddenEmptyCount).toBe(3);

    const bySearch = filterTaskSections(
      model.sections,
      DEFAULT_MAIN_CHAT_FILTER,
      'DemoPlugin',
      false,
    );
    expect(bySearch.sections.flatMap((s) => s.items.map((i) => i.value))).toEqual([
      'task:capability_agent:demo_plugin_agent',
    ]);

    const withEmpty = filterTaskSections(model.sections, DEFAULT_MAIN_CHAT_FILTER, '', true);
    expect(withEmpty.sections.flatMap((s) => s.items.map((i) => i.value))).toContain(
      'task:memory_algebra',
    );
    expect(withEmpty.hiddenEmptyCount).toBe(0);

    // 选中了 0 条子代理时，重新打开菜单仍保留该子代理及其父项，不悬空
    const selectedEmptyChild = filterTaskSections(
      model.sections,
      'task:capability_agent:demo_plugin_agent',
      '',
      false,
    );
    const selectedVals = selectedEmptyChild.sections.flatMap((s) => s.items.map((i) => i.value));
    expect(selectedVals).toContain('task:capability_agent');
    expect(selectedVals).toContain('task:capability_agent:demo_plugin_agent');
  });

  it('falls back to legacy categories list when task_kinds metadata is absent', () => {
    const legacy: SessionLogCategoriesResponse = {
      categories: [
        {
          create_by: 'Chat',
          label: '聊天对话',
          description: '',
          group: 'chat',
          count: 10,
          active_count: 1,
          subagent_count: 0,
        },
        {
          create_by: 'CanvasChat',
          label: 'CanvasChat',
          description: '',
          group: 'other',
          count: 2,
          active_count: 0,
          subagent_count: 0,
        },
      ],
      groups: { chat: 10, other: 2 },
      total: 2,
    };
    const model = buildTaskFilterModel(null, legacy, 12, tr);
    expect(model.sections).toHaveLength(1);
    expect(model.sections[0].items.map((i) => i.value)).toEqual(['task:chat', 'cb:CanvasChat']);
  });
});
