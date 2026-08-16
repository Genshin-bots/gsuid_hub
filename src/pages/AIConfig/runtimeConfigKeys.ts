/**
 * 三线改造后从 AdvancedSettings 拆出的 AI_CONFIG key。
 * 专用 Section 渲染它们，AdvancedSettings 必须排除，否则双份展示。
 */

export const RELATIONSHIP_CONFIG_KEYS: string[] = [
  'favor_engine_enable',
  'favor_floor',
  'favor_ceil',
  'favor_daily_decay',
  'favor_idle_days',
  'favor_daily_gain_cap',
  'favor_daily_loss_cap',
  'favor_session_gain_cap',
  'favor_session_window_minutes',
  'favor_high_zone_diminish',
  'favor_meaningful_min_len',
  'favor_care_signal_enable',
];

export const AGENT_KITS_CONFIG_KEYS: string[] = [
  'agent_hooks_enable',
  'allow_replace_sealed',
];

export const COGNITION_CONFIG_KEYS: string[] = [
  'cognition_artifact_enable',
  'cognition_min_score_ratio',
  'cognition_prefetch_enable',
];

export const RUNTIME_DIVIDER_KEYS: string[] = [
  'Relationship',
  'AgentKits',
  'Cognition',
];

export const KIT_SLOT_KEY_PREFIX = 'kit_slots.';

export function isKitSlotConfigKey(key: string): boolean {
  return key.startsWith(KIT_SLOT_KEY_PREFIX);
}

export const RUNTIME_EXCLUDED_KEYS: string[] = [
  ...RELATIONSHIP_CONFIG_KEYS,
  ...AGENT_KITS_CONFIG_KEYS,
  ...COGNITION_CONFIG_KEYS,
  ...RUNTIME_DIVIDER_KEYS,
];
