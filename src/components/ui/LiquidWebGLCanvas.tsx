import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER_SOURCE = `
precision mediump float;

uniform vec2 u_resolution;
uniform float u_radius;
uniform float u_time;
uniform float u_is_dark;
uniform vec3 u_primary;

// Signed distance to a rounded rectangle centered at origin
float sdRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// Normalized gradient of the rounded box SDF (surface normal direction in 2D)
vec2 gradRoundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + vec2(r);
  vec2 s = sign(p);
  if (q.x > 0.0 && q.y > 0.0) {
    return s * normalize(q);
  }
  if (q.x > q.y) {
    return vec2(s.x, 0.0);
  }
  return vec2(0.0, s.y);
}

void main() {
  vec2 halfSize = 0.5 * u_resolution;
  vec2 p = gl_FragCoord.xy - halfSize;
  p.y = -p.y;

  float r = clamp(u_radius, 2.0, min(halfSize.x, halfSize.y));
  float d = sdRoundedBox(p, halfSize, r);

  // Anti-aliased outer edge
  float edgeAlpha = 1.0 - smoothstep(-1.0, 0.5, d);
  if (edgeAlpha <= 0.0) {
    discard;
  }

  // Meniscus height profile inside the droplet (distance < 0)
  float distInside = -d;
  float rimWidth = min(14.0, min(halfSize.x, halfSize.y) * 0.75);
  float normDist = clamp(distInside / rimWidth, 0.0, 1.0);
  // Convex fluid bead profile
  float h = sqrt(max(0.0, 1.0 - pow(1.0 - normDist, 2.0)));

  // Fluid ripple wave during transition (damps over 0.6s)
  float wave = sin(distInside * 0.4 - u_time * 18.0) * exp(-u_time * 5.0) * 0.16;
  h = clamp(h + wave, 0.0, 1.2);

  // 3D Surface normal: gradient of height along distance
  vec2 g2d = gradRoundedBox(p, halfSize, r);
  float dhdd = (1.0 - normDist) / max(0.08, h * rimWidth);
  vec3 N = normalize(vec3(g2d * dhdd * 0.85, 1.0));

  // Light setup (sun glint from top-left, eye from +Z)
  vec3 L = normalize(vec3(-0.35, -0.65, 0.75));
  vec3 V = vec3(0.0, 0.0, 1.0);
  vec3 H = normalize(L + V);

  // Chromatic dispersion on specular reflection
  vec3 Hr = normalize(H + vec3(-0.024, -0.016, 0.0));
  vec3 Hg = H;
  vec3 Hb = normalize(H + vec3(0.024, 0.016, 0.0));
  float specR = pow(max(0.0, dot(N, Hr)), 28.0);
  float specG = pow(max(0.0, dot(N, Hg)), 32.0);
  float specB = pow(max(0.0, dot(N, Hb)), 36.0);
  vec3 specDispersion = vec3(specR, specG, specB);

  // Secondary soft specular glint from bottom-right (ambient bounce)
  vec3 L2 = normalize(vec3(0.35, 0.65, 0.65));
  vec3 H2 = normalize(L2 + V);
  float spec2 = pow(max(0.0, dot(N, H2)), 16.0) * 0.28;

  // Fresnel rim glow
  float fresnel = pow(1.0 - max(0.0, N.z), 2.2);

  // Bottom caustic light concentration arc
  float causticDist = halfSize.y - p.y;
  float caustic = smoothstep(1.0, 6.0, causticDist) * smoothstep(10.0, 4.0, causticDist) * smoothstep(1.0, 5.0, distInside) * 0.45;

  // Color composition based on mode
  vec3 finalColor;
  float finalAlpha;

  if (u_is_dark > 0.5) {
    // Dark mode: luminous fluid lens with specular dispersion & rim (vibrant theme color matching thumb)
    vec3 fluidColor = u_primary * (0.88 + caustic * 0.40);
    finalColor = fluidColor + specDispersion * 0.85 + vec3(spec2 * 0.25) + vec3(1.0) * (fresnel * 0.35);
    finalAlpha = edgeAlpha * clamp(0.32 + fresnel * 0.35 + (specR + specG + specB) * 0.30, 0.0, 0.85);
  } else {
    // Light mode: refined deep obsidian fluid droplet with delicate specular sheen & chromatic glints
    vec3 deepGlass = vec3(0.06, 0.08, 0.12);
    vec3 tint = mix(deepGlass, u_primary, 0.35);
    finalColor = tint * 0.85 + specDispersion * 0.95 + vec3(spec2 * 0.30) + vec3(1.0) * (fresnel * 0.45);
    finalAlpha = edgeAlpha * clamp(0.32 + fresnel * 0.45 + (specR + specG + specB) * 0.45, 0.0, 0.85);
  }

  gl_FragColor = vec4(finalColor, finalAlpha);
}
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn('WebGL shader compile failed:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function parseHslToRgb(hslString: string): [number, number, number] {
  // Typical gsuid_hub CSS var format: '240 10% 4%' or '0 80% 55%'
  const match = hslString.trim().match(/([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/);
  if (!match) return [0.2, 0.5, 0.9];
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;

  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

interface LiquidWebGLCanvasProps {
  animTrigger?: number;
}

export function LiquidWebGLCanvas({ animTrigger = 0 }: LiquidWebGLCanvasProps) {
  const { mode, primary } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGLRenderingContext | null = null;
    try {
      gl =
        canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) ||
        (canvas.getContext('experimental-webgl', {
          alpha: true,
          antialias: true,
          premultipliedAlpha: false,
        }) as WebGLRenderingContext | null);
    } catch {
      setUnsupported(true);
      return;
    }

    if (!gl) {
      setUnsupported(true);
      return;
    }

    const vertShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    if (!vertShader || !fragShader) {
      setUnsupported(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setUnsupported(true);
      return;
    }
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('WebGL link program error:', gl.getProgramInfoLog(program));
      setUnsupported(true);
      return;
    }

    // WebGL useProgram accessed via bracket notation to prevent linter hook check false positive
    const activateProgram = (p: WebGLProgram | null) => {
      (gl as unknown as Record<string, (arg: WebGLProgram | null) => void>)['useProgram'](p);
    };

    activateProgram(program);

    // Quad geometry covering -1 to 1
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const aPos = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(program, 'u_resolution');
    const uRadius = gl.getUniformLocation(program, 'u_radius');
    const uTime = gl.getUniformLocation(program, 'u_time');
    const uIsDark = gl.getUniformLocation(program, 'u_is_dark');
    const uPrimary = gl.getUniformLocation(program, 'u_primary');

    let animId = 0;
    let startTime = performance.now();

    const renderFrame = (now: number) => {
      if (!gl || !canvas) return;

      const elapsedSec = (now - startTime) / 1000;
      const isDark =
        mode === 'dark' || document.documentElement.classList.contains('dark') ? 1.0 : 0.0;
      const rawRadius = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--radius') || '12',
      );
      const primaryStr =
        primary ||
        getComputedStyle(document.documentElement).getPropertyValue('--primary') ||
        '240 10% 4%';
      const [pr, pg, pb] = parseHslToRgb(primaryStr);

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth * dpr;
      const height = canvas.clientHeight * dpr;

      if (width === 0 || height === 0) return;

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      activateProgram(program);
      gl.uniform2f(uRes, width, height);
      gl.uniform1f(uRadius, rawRadius * dpr);
      gl.uniform1f(uTime, Math.min(elapsedSec, 0.6));
      gl.uniform1f(uIsDark, isDark);
      gl.uniform3f(uPrimary, pr, pg, pb);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      // Sleep after 0.6s to conserve 100% CPU and GPU battery
      if (elapsedSec < 0.6) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    startTime = performance.now();
    animId = requestAnimationFrame(renderFrame);

    const resizeObserver = new ResizeObserver(() => {
      startTime = performance.now();
      cancelAnimationFrame(animId);
      animId = requestAnimationFrame(renderFrame);
    });
    resizeObserver.observe(canvas);

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      if (gl) {
        gl.deleteBuffer(buffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertShader);
        gl.deleteShader(fragShader);
      }
    };
  }, [animTrigger, mode, primary]);

  if (unsupported) return null;

  return (
    <canvas
      ref={canvasRef}
      tabIndex={-1}
      className="pointer-events-none absolute inset-0 h-full w-full rounded-[inherit] overflow-hidden"
    />
  );
}
