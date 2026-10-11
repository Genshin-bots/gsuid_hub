import { useEffect, useState } from 'react';

/**
 * Utility functions for Signed Distance Fields (SDF) and smooth interpolation
 * References:
 * - https://github.com/childrentime/liquid-glass/blob/main/LIQUID_GLASS_EFFECT_CN.md
 * - https://github.com/shuding/liquid-glass/blob/main/liquid-glass.js
 */
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
 * Generate a PNG data URL displacement map using Canvas
 * - R channel encodes horizontal displacement (dx) in [-1, 1]
 * - G channel encodes vertical displacement (dy) in [-1, 1]
 * - 128 = exact 0 offset, >128 = positive, <128 = negative
 * - Default pixels are filled with (128, 128, 128, 255) for exact 0 displacement
 */
function generateDisplacementMap(
  w: number,
  h: number,
  fragment: (x: number, y: number, w: number, h: number) => { dx: number; dy: number },
): { dataUrl: string; scale: number } {
  if (typeof document === 'undefined') {
    return { dataUrl: '', scale: 1 };
  }

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { dataUrl: '', scale: 1 };
  }

  const imgData = ctx.createImageData(w, h);
  const data = imgData.data;

  // Pre-fill everything with neutral 128 (0 offset) and alpha 255
  data.fill(128);
  for (let i = 3; i < data.length; i += 4) {
    data[i] = 255;
  }

  let idx = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const { dx, dy } = fragment(x, y, w, h);
      // Map [-1, 1] to [1, 255] with 128 as exact 0
      data[idx] = Math.round(128 + Math.max(-1, Math.min(1, dx)) * 127);
      data[idx + 1] = Math.round(128 + Math.max(-1, Math.min(1, dy)) * 127);
      // data[idx + 2] = 128 (neutral blue)
      // data[idx + 3] = 255 (opaque)
      idx += 4;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return { dataUrl: canvas.toDataURL(), scale: 1 };
}

/**
 * 1. Card displacement map: for .glass-card and .floating-sidebar
 * - Interior (d < -rimWidth): d < -0.055 -> displacement is IDENTICALLY ZERO.
 *   Text and nested child components stay 100% crisp, sharp and unaffected.
 * - Exterior (d > 0): displacement is IDENTICALLY ZERO.
 * - Beveled Rim (d in [-rimWidth, 0]):
 *   Smooth C^1 lens profile pulse = sin^2(pi * t), where t = -d / rimWidth in [0, 1].
 *   Deflection points along the inward normal (-gradient) of the SDF.
 */
function createCardMap() {
  const halfW = 0.48;
  const halfH = 0.48;
  const radius = 0.04;
  const rimWidth = 0.055;
  const eps = 0.005;

  return generateDisplacementMap(128, 128, (x, y, w, h) => {
    const ix = x / w - 0.5;
    const iy = y / h - 0.5;
    const d = roundedRectSDF(ix, iy, halfW, halfH, radius);

    if (d > 0 || d < -rimWidth) {
      return { dx: 0, dy: 0 };
    }

    const t = -d / rimWidth;
    const pulse = Math.sin(Math.PI * t) ** 2;

    const gx =
      (roundedRectSDF(ix + eps, iy, halfW, halfH, radius) -
        roundedRectSDF(ix - eps, iy, halfW, halfH, radius)) /
      (2 * eps);
    const gy =
      (roundedRectSDF(ix, iy + eps, halfW, halfH, radius) -
        roundedRectSDF(ix, iy - eps, halfW, halfH, radius)) /
      (2 * eps);
    const gLen = Math.sqrt(gx * gx + gy * gy) || 1;
    const nx = gx / gLen;
    const ny = gy / gLen;

    return {
      dx: -pulse * nx,
      dy: -pulse * ny,
    };
  });
}

/**
 * 2. Pill displacement map: for TabButtonGroup (.tab-segment-row) and active tab pills
 * Wide capsule format with delicate beveled rim
 */
function createPillMap() {
  const halfW = 0.47;
  const halfH = 0.4;
  const radius = 0.38;
  const rimWidth = 0.075;
  const eps = 0.005;

  return generateDisplacementMap(128, 64, (x, y, w, h) => {
    const ix = x / w - 0.5;
    const iy = y / h - 0.5;
    const d = roundedRectSDF(ix, iy, halfW, halfH, radius);

    if (d > 0 || d < -rimWidth) {
      return { dx: 0, dy: 0 };
    }

    const t = -d / rimWidth;
    const pulse = Math.sin(Math.PI * t) ** 2;

    const gx =
      (roundedRectSDF(ix + eps, iy, halfW, halfH, radius) -
        roundedRectSDF(ix - eps, iy, halfW, halfH, radius)) /
      (2 * eps);
    const gy =
      (roundedRectSDF(ix, iy + eps, halfW, halfH, radius) -
        roundedRectSDF(ix, iy - eps, halfW, halfH, radius)) /
      (2 * eps);
    const gLen = Math.sqrt(gx * gx + gy * gy) || 1;
    const nx = gx / gLen;
    const ny = gy / gLen;

    return {
      dx: -pulse * nx,
      dy: -pulse * ny,
    };
  });
}

/**
 * 3. Edge displacement map: for docked sidebar (.glass-sidebar)
 * Inner area is flat & crystal clear; right border forms a delicate vertical prism bevel
 */
function createEdgeMap() {
  return generateDisplacementMap(128, 128, (x, _y, w, _h) => {
    const u = x / w;
    if (u < 0.9 || u > 0.98) {
      return { dx: 0, dy: 0 };
    }
    const t = (u - 0.9) / (0.98 - 0.9);
    const pulse = Math.sin(Math.PI * t) ** 2;
    return { dx: -pulse, dy: 0 };
  });
}

/**
 * Shu Ding liquid-glass lens: sample toward the center inside a rounded rect,
 * so the backdrop magnifies like a convex water drop.
 * https://github.com/shuding/liquid-glass/blob/main/liquid-glass.js
 */
function createLensMap() {
  const w = 160;
  const h = 96;
  if (typeof document === 'undefined') {
    return { dataUrl: '', scale: 1 };
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl: '', scale: 1 };

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
}

function initMaps() {
  try {
    const card = createCardMap();
    const pill = createPillMap();
    const edge = createEdgeMap();
    const lens = createLensMap();
    return {
      cardMap: card.dataUrl,
      cardScale: 5.0,
      pillMap: pill.dataUrl,
      pillScale: 4.0,
      edgeMap: edge.dataUrl,
      edgeScale: 4.5,
      lensMap: lens.dataUrl,
      lensScale: lens.scale,
    };
  } catch {
    return {
      cardMap: '',
      cardScale: 5.0,
      pillMap: '',
      pillScale: 4.0,
      edgeMap: '',
      edgeScale: 4.5,
      lensMap: '',
      lensScale: 12,
    };
  }
}

/**
 * Global SVG filters providing true optical displacement refraction and chromatic dispersion
 * for Apple Liquid Glass theme.
 * References:
 * - LIQUID_GLASS_EFFECT_CN.md (feDisplacementMap + SDF displacement maps)
 */
export function LiquidGlassFilter() {
  const [maps, setMaps] = useState(initMaps);

  useEffect(() => {
    if (!maps.cardMap) {
      setMaps(initMaps());
    }
  }, [maps.cardMap]);

  const { cardMap, cardScale, pillMap, pillScale, edgeMap, edgeScale, lensMap, lensScale } = maps;

  return (
    <svg
      className="pointer-events-none fixed -top-full -left-full w-0 h-0 opacity-0 overflow-hidden"
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        {/* ====================================================================
         * 1. Card Filter: Full 3-channel RGB Chromatic Dispersion (色散) & Refraction (折射)
         * ==================================================================== */}
        <filter
          id="liquid-glass-card-filter"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          {cardMap && (
            <feImage
              href={cardMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={cardMap}
              result="cardMapImg"
              preserveAspectRatio="none"
            />
          )}
          {/* Red channel: smaller refraction index */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="cardMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(cardScale * 0.85).toFixed(1)}
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="redOnly"
          />

          {/* Green channel: intermediate refraction index */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="cardMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={cardScale.toFixed(1)}
            result="dispG"
          />
          <feColorMatrix
            in="dispG"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="greenOnly"
          />

          {/* Blue channel: larger refraction index (shorter wavelength bends more) */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="cardMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(cardScale * 1.2).toFixed(1)}
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="blueOnly"
          />

          {/* Additive recombination: Red + Green + Blue */}
          <feComposite
            in="redOnly"
            in2="greenOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="rgBlend"
          />
          <feComposite
            in="rgBlend"
            in2="blueOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="chromaticFinal"
          />
        </filter>

        {/* ====================================================================
         * 2. Pill Filter: TabButtonGroup, Button & Menu Pills Chromatic Dispersion
         * ==================================================================== */}
        <filter
          id="liquid-glass-pill-filter"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          {pillMap && (
            <feImage
              href={pillMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={pillMap}
              result="pillMapImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="pillMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(pillScale * 0.85).toFixed(1)}
            result="dispPillR"
          />
          <feColorMatrix
            in="dispPillR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="pillRedOnly"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="pillMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={pillScale.toFixed(1)}
            result="dispPillG"
          />
          <feColorMatrix
            in="dispPillG"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="pillGreenOnly"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="pillMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(pillScale * 1.2).toFixed(1)}
            result="dispPillB"
          />
          <feColorMatrix
            in="dispPillB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="pillBlueOnly"
          />

          <feComposite
            in="pillRedOnly"
            in2="pillGreenOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="pillRgBlend"
          />
          <feComposite
            in="pillRgBlend"
            in2="pillBlueOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="pillChromaticFinal"
          />
        </filter>

        {/* Shu Ding convex lens. Used by the sliding segment thumb. */}
        <filter
          id="liquid-glass-lens-filter"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          colorInterpolationFilters="sRGB"
        >
          {lensMap && (
            <feImage
              href={lensMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={lensMap}
              result="lensMapImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="lensMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={lensScale.toFixed(1)}
          />
        </filter>

        {/* ====================================================================
         * 3. Edge Filter: Docked Sidebar (.glass-sidebar) Right Prism Edge Dispersion
         * ==================================================================== */}
        <filter
          id="liquid-glass-edge-filter"
          x="-5%"
          y="-5%"
          width="110%"
          height="110%"
          colorInterpolationFilters="sRGB"
        >
          {edgeMap && (
            <feImage
              href={edgeMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={edgeMap}
              result="edgeMapImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(edgeScale * 0.85).toFixed(1)}
            result="dispEdgeR"
          />
          <feColorMatrix
            in="dispEdgeR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="edgeRedOnly"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={edgeScale.toFixed(1)}
            result="dispEdgeG"
          />
          <feColorMatrix
            in="dispEdgeG"
            type="matrix"
            values="0 0 0 0 0
                    0 1 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="edgeGreenOnly"
          />

          <feDisplacementMap
            in="SourceGraphic"
            in2="edgeMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(edgeScale * 1.2).toFixed(1)}
            result="dispEdgeB"
          />
          <feColorMatrix
            in="dispEdgeB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="edgeBlueOnly"
          />

          <feComposite
            in="edgeRedOnly"
            in2="edgeGreenOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="edgeRgBlend"
          />
          <feComposite
            in="edgeRgBlend"
            in2="edgeBlueOnly"
            operator="arithmetic"
            k2="1"
            k3="1"
            result="edgeChromaticFinal"
          />
        </filter>

        {/* Backwards-compatible aliases for single-channel refraction */}
        <filter id="liquid-glass-refraction" colorInterpolationFilters="sRGB">
          {cardMap && (
            <feImage
              href={cardMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={cardMap}
              result="cardRefractImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="cardRefractImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={cardScale.toFixed(1)}
          />
        </filter>

        <filter id="liquid-glass-dispersion" colorInterpolationFilters="sRGB">
          {cardMap && (
            <feImage
              href={cardMap}
              // @ts-expect-error xlinkHref compatibility for SVG in React
              xlinkHref={cardMap}
              result="dispMapImg"
              preserveAspectRatio="none"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(cardScale * 0.85).toFixed(1)}
            result="dispR"
          />
          <feColorMatrix
            in="dispR"
            type="matrix"
            values="1 0 0 0 0
                    0 0 0 0 0
                    0 0 0 0 0
                    0 0 0 1 0"
            result="redOnly"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="dispMapImg"
            xChannelSelector="R"
            yChannelSelector="G"
            scale={(cardScale * 1.15).toFixed(1)}
            result="dispB"
          />
          <feColorMatrix
            in="dispB"
            type="matrix"
            values="0 0 0 0 0
                    0 0 0 0 0
                    0 0 1 0 0
                    0 0 0 1 0"
            result="blueOnly"
          />
          <feComposite in="redOnly" in2="blueOnly" operator="arithmetic" k2="1" k3="1" />
        </filter>
      </defs>
    </svg>
  );
}
