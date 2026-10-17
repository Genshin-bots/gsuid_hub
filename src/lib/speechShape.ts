import type { SpeechShapeSpec } from '@/lib/api';

/** 建议字数滑块和输入框共用这一段。和 chat_style.py 的上下限一致。 */
export const SPEECH_SOFT_MIN = 5;
export const SPEECH_SOFT_MAX = 400;

/** 与 chat_style.py 的三档一致。接口没带回分档表时，编辑页用这份。 */
export const FALLBACK_SPEECH_SHAPE: SpeechShapeSpec = {
  chat_style_min: 0,
  chat_style_max: 100,
  soft_default: 60,
  len_min: SPEECH_SOFT_MIN,
  len_max: SPEECH_SOFT_MAX,
  tiers: [
    {
      floor: 0,
      bubbles: 1,
      soft: 30,
      segment_hint: '一次只说一件事，说完即止。不要分段、不要罗列成多行。',
    },
    {
      floor: 25,
      bubbles: 2,
      soft: 60,
      segment_hint: '默认一整段说完；只有层次确实不同才用空行分成两条。',
    },
    {
      floor: 75,
      bubbles: 4,
      soft: 90,
      segment_hint:
        '可以连发多条短消息：每条之间用一个空行分隔，空行即新消息；每条都要是独立完整的一句，不要半句，最多四条。',
    },
  ],
};

export interface EffectiveSpeech {
  bubbles: number;
  soft: number;
  segmentHint: string;
  softFollows: boolean;
}

export function effectiveSpeech(
  spec: SpeechShapeSpec,
  chatStyle: number,
  soft: number,
): EffectiveSpeech {
  const tiers = [...spec.tiers].sort((left, right) => right.floor - left.floor);
  const tier = tiers.find((item) => chatStyle >= item.floor) ?? tiers[tiers.length - 1];
  const softFollows = soft === spec.soft_default;
  if (!tier) {
    return {
      bubbles: 2,
      soft: softFollows ? spec.soft_default : soft,
      segmentHint: '',
      softFollows,
    };
  }
  return {
    bubbles: tier.bubbles,
    soft: softFollows ? tier.soft : soft,
    segmentHint: tier.segment_hint,
    softFollows,
  };
}
