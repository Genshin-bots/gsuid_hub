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

/**
 * 切换页签或初次呈现时：原地轻微弹动，绝不从 (0, 0) 大幅度横向飞入
 */
function writeInPlaceBounce(el: HTMLElement, box: Box) {
  for (const animation of el.getAnimations()) animation.cancel();
  el.style.opacity = '1';
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;

  el.animate(
    [
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(0.95)`, opacity: 0.8 },
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(1.03)`, offset: 0.6 },
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(1)`, opacity: 1 },
    ],
    {
      duration: 260,
      easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      fill: 'none',
    },
  );
}

/**
 * 组内正常切换选项时：轻快弹性弹动，不过度拉伸变形
 */
function writeSpringMove(el: HTMLElement, fromBox: Box, toBox: Box) {
  for (const animation of el.getAnimations()) animation.cancel();
  el.style.opacity = '1';
  el.style.width = `${toBox.w}px`;
  el.style.height = `${toBox.h}px`;
  el.style.transform = `translate3d(${toBox.x}px, ${toBox.y}px, 0)`;

  const currentTrans = readTranslation(el);
  const fromX = currentTrans.x !== 0 || currentTrans.y !== 0 ? currentTrans.x : fromBox.x;
  const fromY = currentTrans.x !== 0 || currentTrans.y !== 0 ? currentTrans.y : fromBox.y;
  const fromW = el.getBoundingClientRect().width || fromBox.w;
  const fromH = el.getBoundingClientRect().height || fromBox.h;

  const midX = (fromX + toBox.x) / 2;
  const midY = (fromY + toBox.y) / 2;
  const midW = (fromW + toBox.w) / 2;
  const midH = (fromH + toBox.h) / 2;

  el.animate(
    [
      {
        transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(1)`,
        width: `${fromW}px`,
        height: `${fromH}px`,
      },
      {
        transform: `translate3d(${midX}px, ${midY}px, 0) scale(0.98)`,
        width: `${midW}px`,
        height: `${midH}px`,
        offset: 0.5,
      },
      {
        transform: `translate3d(${toBox.x}px, ${toBox.y}px, 0) scale(1.02)`,
        width: `${toBox.w}px`,
        height: `${toBox.h}px`,
        offset: 0.8,
      },
      {
        transform: `translate3d(${toBox.x}px, ${toBox.y}px, 0) scale(1)`,
        width: `${toBox.w}px`,
        height: `${toBox.h}px`,
      },
    ],
    {
      duration: 240,
      easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      fill: 'none',
    },
  );
}

/**
 * 分段选中胶囊：优雅弹动，切换页签无大幅度飞入。
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
  const wasHiddenRef = useRef(true);

  useEffect(() => {
    const root = containerRef.current;
    const el = thumbRef.current;
    if (!root || !el) return;

    // 检查容器是否可见（不在 display: none / hidden 容器内）
    const isVisible = root.offsetParent !== null && root.getClientRects().length > 0;
    if (!isVisible) {
      wasHiddenRef.current = true;
      boxRef.current = null;
      el.style.opacity = '0';
      return;
    }

    const next = readBox(root, activeSelector);
    if (!next || next.w <= 0 || next.h <= 0) {
      el.style.opacity = '0';
      return;
    }

    const prev = boxRef.current;
    if (prev && nearly(prev, next)) return;

    // 如果之前不可见或首次定位（例如切换页签初次呈现），只做原地轻巧弹动，绝不从 (0, 0) 远距离飞入
    if (wasHiddenRef.current || !prev) {
      wasHiddenRef.current = false;
      boxRef.current = next;
      writeInPlaceBounce(el, next);
      return;
    }

    // 组内正常切换选项：轻快弹动滑向目标项
    boxRef.current = next;
    writeSpringMove(el, prev, next);
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let timer = 0;
    const settle = () => {
      const el = thumbRef.current;
      if (!root || !el) return;
      const isVisible = root.offsetParent !== null && root.getClientRects().length > 0;
      if (!isVisible) {
        wasHiddenRef.current = true;
        boxRef.current = null;
        return;
      }
      const next = readBox(root, activeSelector);
      if (!next || next.w <= 0 || next.h <= 0) return;
      const prev = boxRef.current;
      if (prev && nearly(prev, next)) return;
      boxRef.current = next;

      // 视口尺寸变化时直接重置位置尺寸，不播放多余动画
      for (const animation of el.getAnimations()) animation.cancel();
      el.style.opacity = '1';
      el.style.width = `${next.w}px`;
      el.style.height = `${next.h}px`;
      el.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
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
