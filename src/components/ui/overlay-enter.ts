import { useCallback, useRef } from 'react';

/**
 * 弹层内容往往包在 Portal 里，外层组件比真正的 DOM 更早挂上。
 * 淡入必须等节点出现再排，否则人格抽屉会停在透明，只剩白色遮罩。
 * prep：仍透明，但允许铺上毛玻璃。true：开始淡入。
 */
export function useOverlayEnterCallback() {
  const frames = useRef({ prep: 0, fade: 0 });

  return useCallback((node: HTMLElement | null) => {
    cancelAnimationFrame(frames.current.prep);
    cancelAnimationFrame(frames.current.fade);
    if (!node) return;
    frames.current.prep = requestAnimationFrame(() => {
      node.setAttribute('data-overlay-enter', 'prep');
      frames.current.fade = requestAnimationFrame(() => {
        node.setAttribute('data-overlay-enter', 'true');
      });
    });
  }, []);
}
