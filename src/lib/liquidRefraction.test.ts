import { describe, expect, it } from 'vitest';
import { bezelFor, buildRefractionMap } from './liquidRefraction';

describe('liquidRefraction', () => {
  it('clamps bezel width to 8..28px', () => {
    expect(bezelFor(20, 20)).toBe(8);
    expect(bezelFor(80, 60)).toBe(15);
    expect(bezelFor(400, 300)).toBe(28);
  });

  it('builds a neutral-centered displacement map at 0.25 resolution by default', () => {
    const map = buildRefractionMap({ width: 200, height: 120, radius: 16, bezel: 20 });
    expect(map.width).toBe(50);
    expect(map.height).toBe(30);
    expect(map.scale).toBeCloseTo(36);
    expect(map.fringe.length).toBe(0);

    // 中心像素在斜面以内，R/G 必须保持精确中性 128
    const centerIdx = (15 * map.width + 25) * 4;
    expect(map.data[centerIdx]).toBe(128);
    expect(map.data[centerIdx + 1]).toBe(128);
    expect(map.data[centerIdx + 2]).toBe(128);
    expect(map.data[centerIdx + 3]).toBe(255);

    // 贴近左边缘像素应向内部（+X）偏移，R > 128
    const leftEdgeIdx = (15 * map.width + 0) * 4;
    expect(map.data[leftEdgeIdx]).toBeGreaterThan(128);
  });

  it('generates fringe buffer only when includeFringe is true', () => {
    const map = buildRefractionMap({ width: 100, height: 80, radius: 12, bezel: 20 }, 0.25, {
      includeFringe: true,
    });
    expect(map.fringe.length).toBe(map.width * map.height * 4);
  });
});
