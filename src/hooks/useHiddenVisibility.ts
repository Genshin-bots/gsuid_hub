import { useEffect, useRef, type RefObject } from 'react';

/** 祖先被 KeptPane 标成 hidden 时通知。图谱力导在离屏时要停，回来再刷新画布。 */
export function useHiddenVisibility(
  ref: RefObject<HTMLElement | null>,
  onChange: (hidden: boolean) => void,
) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => onChangeRef.current(el.closest('[hidden]') != null);
    const observer = new MutationObserver(sync);
    let node: HTMLElement | null = el.parentElement;
    while (node) {
      observer.observe(node, { attributes: true, attributeFilter: ['hidden'] });
      node = node.parentElement;
    }
    return () => observer.disconnect();
  }, [ref]);
}
