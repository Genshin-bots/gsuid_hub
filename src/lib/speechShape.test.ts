import { describe, expect, it } from 'vitest';

import { FALLBACK_SPEECH_SHAPE, effectiveSpeech } from '@/lib/speechShape';

describe('effectiveSpeech', () => {
  const spec = FALLBACK_SPEECH_SHAPE;

  it('keeps the template default on the tier', () => {
    const low = effectiveSpeech(spec, 0, 60);
    expect(low.soft).toBe(30);
    expect(low.bubbles).toBe(1);
    expect(low.softFollows).toBe(true);

    const mid = effectiveSpeech(spec, 50, 60);
    expect(mid.soft).toBe(60);
    expect(mid.bubbles).toBe(2);

    const high = effectiveSpeech(spec, 75, 60);
    expect(high.soft).toBe(90);
    expect(high.bubbles).toBe(4);
  });

  it('pins a number that is not the template default', () => {
    const pinned = effectiveSpeech(spec, 0, 45);
    expect(pinned.soft).toBe(45);
    expect(pinned.softFollows).toBe(false);
    expect(pinned.bubbles).toBe(1);
  });
});
