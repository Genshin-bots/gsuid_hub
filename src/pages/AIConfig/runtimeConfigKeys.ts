/**
 * 「高级设置」页的白名单分组与保留隐藏键定义。
 *
 * 高级设置采用两段式白名单渲染：
 * - PRIMARY：普通部署者常用的 14 项配置（按 4 个场景分组展示）
 * - EXPERT：调试 / 评测 / 运维用的 16 项专家调参（默认折叠）
 * 其余架构级 / 灰度开关（kit_slots.*、agent_hooks_enable、cognition_*）仅通过配置文件调整。
 */

export interface AdvancedSettingGroup {
  id: string;
  labelKey: string;
  keys: readonly string[];
}

export const ADVANCED_PRIMARY_GROUPS: readonly AdvancedSettingGroup[] = [
  {
    id: 'access',
    labelKey: 'aiConfig.advancedSettings.groups.access',
    keys: ['white_list', 'black_list'],
  },
  {
    id: 'interaction',
    labelKey: 'aiConfig.advancedSettings.groups.interaction',
    keys: ['follow_up_window', 'group_lurk_mode'],
  },
  {
    id: 'limits',
    labelKey: 'aiConfig.advancedSettings.groups.limits',
    keys: ['agent_max_history', 'multi_agent_lenth', 'agent_max_tokens', 'lazy_image_read'],
  },
  {
    id: 'personaSafety',
    labelKey: 'aiConfig.advancedSettings.groups.personaSafety',
    keys: [
      'favor_engine_enable',
      'output_firewall_enable',
      'output_firewall_extra_terms',
      'memory_sensitive_extra_terms',
      'render_long_markdown_as_image',
      'enable_deepseek_rp',
    ],
  },
];

export const EXPERT_TUNING_GROUPS: readonly AdvancedSettingGroup[] = [
  {
    id: 'retrieval',
    labelKey: 'aiConfig.advancedSettings.expertGroups.retrieval',
    keys: [
      'tool_search_recall',
      'tool_extra_pool_max',
      'tool_context_window',
      'tool_recall_threshold',
      'knowledge_recall_threshold',
    ],
  },
  {
    id: 'runtime',
    labelKey: 'aiConfig.advancedSettings.expertGroups.runtime',
    keys: [
      'subagent_max_concurrency',
      'task_max_iterations',
      'task_max_tokens',
      'agent_max_run_attempts',
      'agent_run_retry_delay',
      'mcp_profile_llm_enable',
    ],
  },
  {
    id: 'debugSafety',
    labelKey: 'aiConfig.advancedSettings.expertGroups.debugSafety',
    keys: [
      'suppress_intermediate_text',
      'content_guard_enable',
      'follow_up_max_total',
      'follow_up_max_replies',
      'cognition_mount_enable',
    ],
  },
];

/** 架构与灰度隐藏键：只保留在后端配置文件中，不暴露在高级设置页。 */
export const HIDDEN_RUNTIME_CONFIG_KEYS: readonly string[] = [
  'agent_hooks_enable',
  'allow_replace_sealed',
  'cognition_artifact_enable',
  'cognition_min_score_ratio',
  'cognition_prefetch_enable',
];

export const KIT_SLOT_KEY_PREFIX = 'kit_slots.';

export function isKitSlotConfigKey(key: string): boolean {
  return key.startsWith(KIT_SLOT_KEY_PREFIX);
}
