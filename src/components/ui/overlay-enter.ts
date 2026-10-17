import { useEffect } from 'react';

/**
 * 打开弹层时先让浏览器画出「还没开始」的那一帧，再开淡入。
 * 人格抽屉的布局和毛玻璃会占住主线程。入场动画若在插入 DOM 时就开始，
 * 第一帧画出来时已经播完，白罩就像瞬间出现。
 * prep：仍透明，但允许铺上毛玻璃。true：开始淡入。
 */
export function useOverlayEnter(ref: { readonly current: HTMLElement | null }) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    let fadeFrame = 0;
    const prepFrame = requestAnimationFrame(() => {
      node.setAttribute('data-overlay-enter', 'prep');
      fadeFrame = requestAnimationFrame(() => {
        node.setAttribute('data-overlay-enter', 'true');
      });
    });
    return () => {
      cancelAnimationFrame(prepFrame);
      cancelAnimationFrame(fadeFrame);
    };
  }, [ref]);
}
