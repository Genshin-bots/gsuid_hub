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
 * 切换页签或初次呈现时：原地轻快弹动，绝不从外部横向飞入
 */
function writeInPlaceBounce(el: HTMLElement, box: Box) {
  for (const animation of el.getAnimations()) animation.cancel();
  el.style.opacity = '1';
  el.style.width = `${box.w}px`;
  el.style.height = `${box.h}px`;
  el.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;

  el.animate(
    [
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(0.88)`, opacity: 0.6 },
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(1.06)`, offset: 0.58 },
      { transform: `translate3d(${box.x}px, ${box.y}px, 0) scale(1)`, opacity: 1 },
    ],
    {
      duration: 300,
      easing: 'cubic-bezier(0.34, 1.4, 0.64, 1)',
      fill: 'none',
    },
  );
}

/**
 * 组内正常点击切换选项时：左右滑动位移 + 弹性拉伸回弹
 */
function writeSpringMove(el: HTMLElement, fromBox: Box, toBox: Box) {
  const animations = el.getAnimations();
  const isRunning = animations.some((a) => a.playState === 'running');
  // 必须在给 el.style.transform 写入终点之前读取当前位置，否则读到的永远是终点导致位移为 0
  const currentTrans = isRunning ? readTranslation(el) : { x: fromBox.x, y: fromBox.y };
  const fromX = isRunning ? currentTrans.x : fromBox.x;
  const fromY = isRunning ? currentTrans.y : fromBox.y;
  const fromW = isRunning ? el.getBoundingClientRect().width || fromBox.w : fromBox.w;
  const fromH = isRunning ? el.getBoundingClientRect().height || fromBox.h : fromBox.h;

  for (const animation of animations) animation.cancel();

  // 写入终点样式（动画覆盖它，结束后停在终点）
  el.style.opacity = '1';
  el.style.width = `${toBox.w}px`;
  el.style.height = `${toBox.h}px`;
  el.style.transform = `translate3d(${toBox.x}px, ${toBox.y}px, 0)`;

  const travel = Math.hypot(toBox.x - fromX, toBox.y - fromY);
  if (travel < 1) return;

  const stretch = 1 + Math.min(0.18, travel / 480);
  const dir = toBox.x >= fromX ? 1 : -1;
  const pastX = toBox.x + dir * Math.min(8, travel * 0.06);
  const midX = (fromX + toBox.x) / 2;
  const midY = (fromY + toBox.y) / 2;

  el.animate(
    [
      {
        transform: `translate3d(${fromX}px, ${fromY}px, 0) scaleX(1)`,
        width: `${fromW}px`,
        height: `${fromH}px`,
      },
      {
        transform: `translate3d(${midX}px, ${midY}px, 0) scaleX(${stretch})`,
        width: `${(fromW + toBox.w) / 2}px`,
        height: `${(fromH + toBox.h) / 2}px`,
        offset: 0.45,
      },
      {
        transform: `translate3d(${pastX}px, ${toBox.y}px, 0) scaleX(0.97)`,
        width: `${toBox.w}px`,
        height: `${toBox.h}px`,
        offset: 0.78,
      },
      {
        transform: `translate3d(${toBox.x}px, ${toBox.y}px, 0) scaleX(1)`,
        width: `${toBox.w}px`,
        height: `${toBox.h}px`,
      },
    ],
    {
      duration: 300,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'none',
    },
  );
}

/**
 * 分段选中高亮胶囊：
 * - 组内直接点击切换：左右滑动
 * - 切换外部页签/页面呈现：原地轻快弹动
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

  // 监听祖先元素的 hidden 状态变化（适配 KeptPane 等保活隐藏面板的恢复显现）
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const syncAncestorVisibility = () => {
      const isHidden =
        root.closest('[hidden]') != null ||
        root.offsetParent === null ||
        root.getClientRects().length === 0;

      if (isHidden) {
        wasHiddenRef.current = true;
        boxRef.current = null;
        if (thumbRef.current) thumbRef.current.style.opacity = '0';
      } else if (wasHiddenRef.current) {
        requestAnimationFrame(() => {
          if (!root.isConnected || root.offsetParent === null) return;
          const el = thumbRef.current;
          if (!el) return;
          const next = readBox(root, activeSelector);
          if (next && next.w > 0 && next.h > 0) {
            wasHiddenRef.current = false;
            boxRef.current = next;
            writeInPlaceBounce(el, next);
          }
        });
      }
    };

    const observer = new MutationObserver(syncAncestorVisibility);
    let parent = root.parentElement;
    while (parent) {
      observer.observe(parent, { attributes: true, attributeFilter: ['hidden', 'class', 'style'] });
      parent = parent.parentElement;
    }
    return () => observer.disconnect();
  }, [containerRef, activeSelector]);

  useEffect(() => {
    const root = containerRef.current;
    const el = thumbRef.current;
    if (!root || !el) return;

    // 检查容器是否可见（不在 display: none / hidden 容器内）
    const isHidden =
      root.closest('[hidden]') != null ||
      root.offsetParent === null ||
      root.getClientRects().length === 0;

    if (isHidden) {
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

    // 之前不可见（刚挂载、刚从 hidden 显现、或首次定位）：原地轻快弹动，绝不横向飞入
    if (wasHiddenRef.current || !prev) {
      boxRef.current = next;
      wasHiddenRef.current = false;
      writeInPlaceBounce(el, next);
      return;
    }

    // 持续可见状态下的组内选项切换：左右滑动
    boxRef.current = next;
    wasHiddenRef.current = false;
    writeSpringMove(el, prev, next);
  });

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    let timer = 0;
    const settle = () => {
      const el = thumbRef.current;
      if (!root || !el) return;
      const isHidden =
        root.closest('[hidden]') != null ||
        root.offsetParent === null ||
        root.getClientRects().length === 0;

      if (isHidden) {
        wasHiddenRef.current = true;
        boxRef.current = null;
        return;
      }
      const next = readBox(root, activeSelector);
      if (!next || next.w <= 0 || next.h <= 0) return;
      const prev = boxRef.current;
      if (prev && nearly(prev, next)) return;
      boxRef.current = next;

      // 如果之前不可见刚切出来，执行原地轻弹
      if (wasHiddenRef.current) {
        wasHiddenRef.current = false;
        writeInPlaceBounce(el, next);
        return;
      }

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
