import { useMemo } from 'react';
import { useThemeStyle } from '@/contexts/ThemeContext';

function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function roundedRectSDF(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): number {
  const qx = Math.abs(x) - width + radius;
  const qy = Math.abs(y) - height + radius;
  return Math.min(Math.max(qx, qy), 0) + length(Math.max(qx, 0), Math.max(qy, 0)) - radius;
}

/**
 * Shu Ding liquid-glass lens: sample toward the center inside a rounded rect,
 * so the backdrop magnifies like a convex water drop.
 * https://github.com/shuding/liquid-glass/blob/main/liquid-glass.js
 */
function createLensMap(): { dataUrl: string; scale: number } {
  const w = 160;
  const h = 96;
  if (typeof document === 'undefined') {
    return { dataUrl: '', scale: 12 };
  }
  try {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { dataUrl: '', scale: 12 };

    const raw: number[] = [];
    let maxScale = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ix = x / w - 0.5;
        const iy = y / h - 0.5;
        const distanceToEdge = roundedRectSDF(ix, iy, 0.3, 0.2, 0.6);
        const displacement = smoothStep(0.8, 0, distanceToEdge - 0.15);
        const scaled = smoothStep(0, 1, displacement);
        const dx = (ix * scaled + 0.5) * w - x;
        const dy = (iy * scaled + 0.5) * h - y;
        maxScale = Math.max(maxScale, Math.abs(dx), Math.abs(dy));
        raw.push(dx, dy);
      }
    }
    maxScale *= 0.5;
    if (maxScale < 1) maxScale = 1;

    const imgData = ctx.createImageData(w, h);
    const data = imgData.data;
    let index = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = raw[index++] / maxScale + 0.5;
      const g = raw[index++] / maxScale + 0.5;
      data[i] = Math.max(0, Math.min(255, r * 255));
      data[i + 1] = Math.max(0, Math.min(255, g * 255));
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
    return { dataUrl: canvas.toDataURL(), scale: maxScale };
  } catch {
    return { dataUrl: '', scale: 12 };
  }
}

/**
 * 仅在液态玻璃模式下按需挂载分段滑动拇指抬起态使用的凸透镜 SVG 滤镜。
 * 非液态模式下不生成 Canvas 位图、不挂载 SVG defs。
 */
export function LiquidGlassFilter() {
  const { style } = useThemeStyle();
  const isLiquid = style === 'liquid';
  const lens = useMemo(() => (isLiquid ? createLensMap() : null), [isLiquid]);

  if (!isLiquid || !lens) {
    return null;
  }

  return (
    <svg
      className="pointer-events-none fixed -top-full -left-full w-0 h-0 opacity-0 overflow-hidden"
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        {/* Shu Ding convex lens. Used by the sliding segment thumb when lifted. */}
        <filter
          id="liquid-glass-lens-filter"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          {lens.dataUrl && (
            <feImage
              href={lens.dataUrl}
              xlinkHref={lens.dataUrl}
              result="lensMapImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="lensMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={lens.scale.toFixed(1)}
          />
        </filter>
      </defs>
    </svg>
  );
}
