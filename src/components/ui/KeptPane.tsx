import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * 点击重内容页签时，先让选中态画出来，再挂内容。
 * setTimeout(0) 经常抢在绘制前面，第一次点击还是卡。
 * 两帧回调中间一定会画一次。挂过的区块用 hidden 留在树上。
 * 静态重内容可以 preload，空闲时一个一个预挂。会发请求的页签不要开。
 */
const preloadWaiters: Array<() => void> = [];
let preloadBusy = false;

function pumpPreload() {
  if (preloadBusy || preloadWaiters.length === 0) return;
  const start = preloadWaiters.shift();
  if (!start) return;
  preloadBusy = true;
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => start(), { timeout: 700 });
  } else {
    window.setTimeout(start, 240);
  }
}

function requestPreloadTurn(start: () => void) {
  preloadWaiters.push(start);
  pumpPreload();
  return () => {
    const index = preloadWaiters.indexOf(start);
    if (index >= 0) preloadWaiters.splice(index, 1);
  };
}

function releasePreloadTurn() {
  preloadBusy = false;
  pumpPreload();
}

function afterPaint(run: () => void) {
  let second = 0;
  const first = requestAnimationFrame(() => {
    second = requestAnimationFrame(run);
  });
  return () => {
    cancelAnimationFrame(first);
    if (second) cancelAnimationFrame(second);
  };
}

export function KeptPane({
  active,
  version,
  live = false,
  preload = false,
  holdPreload = false,
  render,
  wrap,
  className,
}: {
  active: boolean;
  /** 选中且已经画出之后，版本变了才换节点。不传则只在第一次挂上。 */
  version?: unknown;
  /** 选中期间每次父级渲染都换节点，表单和筛选才会跟上。 */
  live?: boolean;
  preload?: boolean;
  /** 预挂先别让出队列，等 wrap 里的分批挂完再调 release。 */
  holdPreload?: boolean;
  render: () => ReactNode;
  wrap?: (node: ReactNode, releasePreload: () => void) => ReactNode;
  /** 附加在外壳上。不要再写 display，否则会压过 hidden。 */
  className?: string;
}) {
  const renderRef = useRef(render);
  renderRef.current = render;
  const cache = useRef<{ node: ReactNode; version: unknown } | null>(null);
  const holdingTurn = useRef(false);
  const [built, setBuilt] = useState(active);
  const [acceptVersion, setAcceptVersion] = useState(active);

  const releasePreload = () => {
    if (!holdingTurn.current) return;
    holdingTurn.current = false;
    releasePreloadTurn();
  };

  useEffect(() => {
    if (!active) {
      setAcceptVersion(false);
      return;
    }
    let cancelled = false;
    const cancel = afterPaint(() => {
      if (!cancelled) setAcceptVersion(true);
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [active]);

  useEffect(() => {
    if (!active || built) return;
    let cancelled = false;
    const cancel = afterPaint(() => {
      if (!cancelled) setBuilt(true);
    });
    return () => {
      cancelled = true;
      cancel();
    };
  }, [active, built]);

  useEffect(() => {
    if (!preload || active || built) return;
    let cancelled = false;
    const cancelWait = requestPreloadTurn(() => {
      if (cancelled) {
        releasePreloadTurn();
        return;
      }
      holdingTurn.current = true;
      setBuilt(true);
    });
    return () => {
      cancelled = true;
      cancelWait();
    };
  }, [preload, active, built]);

  useEffect(() => {
    if (!built || !holdingTurn.current || holdPreload) return;
    holdingTurn.current = false;
    releasePreloadTurn();
  }, [built, holdPreload]);

  useEffect(() => {
    return () => {
      if (!holdingTurn.current) return;
      holdingTurn.current = false;
      releasePreloadTurn();
    };
  }, []);

  if (built) {
    const missing = cache.current == null;
    const stale =
      !missing && active && acceptVersion && (live || !Object.is(cache.current?.version, version));
    if (missing || stale) {
      cache.current = { version, node: renderRef.current() };
    }
  }

  if (cache.current == null) {
    return active ? <div className="min-h-32" /> : null;
  }

  const body = wrap ? wrap(cache.current.node, releasePreload) : cache.current.node;
  return (
    <div hidden={!active} className={className ? `kept-pane ${className}` : 'kept-pane'}>
      {body}
    </div>
  );
}
