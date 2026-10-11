import React from 'react';

/**
 * Global SVG filter providing optical refraction for Luminous Glass surfaces.
 * Hidden from layout and screen readers; referenced via CSS url(#luminous-glass-refraction).
 */
export function LuminousGlassFilter() {
  return (
    <svg
      className="pointer-events-none fixed -top-full -left-full w-0 h-0 opacity-0 overflow-hidden"
      aria-hidden="true"
      style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}
    >
      <defs>
        <filter
          id="luminous-glass-refraction"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.018 0.022"
            numOctaves="2"
            result="fluidNoise"
            seed="16"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="fluidNoise"
            scale="5"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>
  );
}
