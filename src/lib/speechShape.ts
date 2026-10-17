import type { SpeechShapeSpec } from '@/lib/api';

/** 与 chat_style.py 的三档一致。接口没带回分档表时，编辑页用这份。 */
export const FALLBACK_SPEECH_SHAPE: SpeechShapeSpec = {
  chat_style_min: 0,
  chat_style_max: 100,
  soft_default: 60,
  hard_default: 150,
  len_min: 1,
  len_max: 4000,
  tiers: [
    {
      floor: 0,
      bubbles: 1,
      soft: 30,
      hard: 80,
      segment_hint: '一次只说一件事，说完即止。不要分段、不要罗列成多行。',
    },
    {
      floor: 25,
      bubbles: 2,
      soft: 60,
      hard: 150,
      segment_hint: '默认一整段说完；只有层次确实不同才用空行分成两条。',
    },
    {
      floor: 75,
      bubbles: 4,
      soft: 90,
      hard: 200,
      segment_hint:
        '可以连发多条短消息：每条之间用一个空行分隔，空行即新消息；每条都要是独立完整的一句，不要半句，最多四条。',
    },
  ],
};

export interface EffectiveSpeech {
  bubbles: number;
  soft: number;
  hard: number;
  segmentHint: string;
  softFollows: boolean;
  hardFollows: boolean;
}

export function effectiveSpeech(
  spec: SpeechShapeSpec,
  chatStyle: number,
  soft: number,
  hard: number,
): EffectiveSpeech {
  const tiers = [...spec.tiers].sort((left, right) => right.floor - left.floor);
  const tier = tiers.find((item) => chatStyle >= item.floor) ?? tiers[tiers.length - 1];
  const softFollows = soft === spec.soft_default;
  const hardFollows = hard === spec.hard_default;
  if (!tier) {
    return {
      bubbles: 2,
      soft: softFollows ? spec.soft_default : soft,
      hard: hardFollows ? spec.hard_default : hard,
      segmentHint: '',
      softFollows,
      hardFollows,
    };
  }
  return {
    bubbles: tier.bubbles,
    soft: softFollows ? tier.soft : soft,
    hard: hardFollows ? tier.hard : hard,
    segmentHint: tier.segment_hint,
    softFollows,
    hardFollows,
  };
}
