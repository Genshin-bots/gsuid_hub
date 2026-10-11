import { useEffect, useRef } from 'react';

type Box = { x: number; y: number; w: number; h: number };

function readBox(root: HTMLElement, activeSelector: string): Box | null {
  const active = root.querySelector(activeSelector);
  if (!(active instanceof HTMLElement)) return null;
  const rootBox = root.getBoundingClientRect();
  const activeBox = active.getBoundingClientRect();
  return {
    x: activeBox.left - rootBox.left,
    y: activeBox.top - rootBox.top,
    w: activeBox.width,
    h: activeBox.height,
  };
}

function nearly(a: Box, b: Box) {
  return (
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.w - b.w) < 0.5 &&
    Math.abs(a.h - b.h) < 0.5
  );
}

function readTranslation(el: HTMLElement): { x: number; y: number } {
  const t = getComputedStyle(el).transform;
  if (!t || t === 'none') return { x: 0, y: 0 };
  const m = new DOMMatrix(t);
  return { x: m.m41, y: m.m42 };
}

function writeBox(el: HTMLElement, box: Box, animate: boolean, duration = 560) {
  const from = readTranslation(el);
  const fromW = el.getBoundingClientRect().width || box.w;
  const fromH = el.getBoundingClientRect().height || box.h;
  for (const animation of el.getAnimations()) animation.cancel();
  el.style.opacity = '1';
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
  if (!animate) return;

  const travel = Math.hypot(box.x - from.x, box.y - from.y);
  const stretch = duration < 400 ? 1 : 1 + Math.min(0.16, travel / 640);
  const dir = box.x >= from.x ? 1 : -1;
  const pastX = box.x + dir * (duration < 400 ? 0 : Math.min(12, travel * 0.07));
  const midX = (from.x + box.x) / 2;
  const midY = (from.y + box.y) / 2;
  const frames: Keyframe[] =
    duration < 400
      ? [
          {
            transform: `translate3d(${from.x}px, ${from.y}px, 0)`,
            width: `${fromW}px`,
            height: `${fromH}px`,
          },
          {
            transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
            width: `${box.w}px`,
            height: `${box.h}px`,
          },
        ]
      : [
          {
            transform: `translate3d(${from.x}px, ${from.y}px, 0) scaleX(1)`,
            width: `${fromW}px`,
            height: `${fromH}px`,
          },
          {
            transform: `translate3d(${midX}px, ${midY}px, 0) scaleX(${stretch})`,
            width: `${(fromW + box.w) / 2}px`,
            height: `${(fromH + box.h) / 2}px`,
            offset: 0.42,
          },
          {
            transform: `translate3d(${pastX}px, ${box.y}px, 0) scaleX(0.98)`,
            width: `${box.w}px`,
            height: `${box.h}px`,
            offset: 0.78,
          },
          {
            transform: `translate3d(${box.x}px, ${box.y}px, 0) scaleX(1)`,
            width: `${box.w}px`,
            height: `${box.h}px`,
          },
        ];
  // 终点先写进样式。动画播放时盖过它，结束后停在终点。
  el.animate(frames, {
    duration,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    fill: 'none',
  });
}

/**
 * 分段选中胶囊。用 Web Animations 从当前视觉位置滑到下一项，中途略拉长再回弹。
 * 不要靠 CSS transition：同一帧里改 transition 和 transform 会直接跳到终点。
 */
export function LiquidSegmentThumb({
  containerRef,
  activeSelector,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  activeSelector: string;
}) {
  const thumbRef = useRef<HTMLSpanElement>(null);
  const boxRef = useRef<Box | null>(null);
  const placedRef = useRef(false);

  useEffect(() => {
    const root = containerRef.current;
    const el = thumbRef.current;
    if (!root || !el) return;
    const next = readBox(root, activeSelector);
    if (!next) {
      el.style.opacity = '0';
      return;
    }
    const prev = boxRef.current;
    if (prev && nearly(prev, next)) return;
    const animate = placedRef.current;
    writeBox(el, next, animate);
    boxRef.current = next;
    placedRef.current = true;
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let timer = 0;
    // 侧边栏收起会在选中动画之后改布局。等宽度停稳再量一次，把胶囊对齐到新位置。
    const settle = () => {
      const el = thumbRef.current;
      if (!root || !el) return;
      const next = readBox(root, activeSelector);
      if (!next) return;
      const prev = boxRef.current;
      if (prev && nearly(prev, next)) return;
      const running = el.getAnimations().some((animation) => animation.playState === 'running');
      writeBox(el, next, running, 220);
      boxRef.current = next;
    };
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, 80);
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [activeSelector, containerRef]);

  return (
    <span ref={thumbRef} aria-hidden className="liquid-segment-thumb" style={{ opacity: 0 }} />
  );
}
