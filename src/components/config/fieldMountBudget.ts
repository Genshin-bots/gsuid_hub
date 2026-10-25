import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * 页签里的配置项不能在一次提交里挂完，否则第一次点开会卡住。
 * 正在看的页签每帧挂几项；没在看的页签只在浏览器空闲时慢慢挂。
 * 没包 FieldMountBudget 的短表单（弹窗）一次全部挂上。
 */
const FOREGROUND_STEP = 4;
const BACKGROUND_STEP = 2;

type Job = {
  need: number;
  apply: (grant: number) => void;
};

type Budget = {
  warm: boolean;
  drained: boolean;
  paused: boolean;
  foreground: boolean;
  scheduled: boolean;
  queue: Job[];
  notifyDrained?: () => void;
  requestMore: (need: number, apply: (grant: number) => void) => () => void;
};

const budgets = new Set<Budget>();
const FieldMountBudgetContext = createContext<Budget | null>(null);

function foregroundBusy() {
  for (const budget of budgets) {
    if (budget.foreground && budget.queue.length > 0) return true;
  }
  return false;
}

function createBudget(): Budget {
  const budget: Budget = {
    warm: false,
    drained: false,
    paused: false,
    foreground: true,
    scheduled: false,
    queue: [],
    requestMore(need: number, apply: (grant: number) => void) {
      if (need <= 0) return () => {};
      if (budget.warm) {
        apply(need);
        return () => {};
      }
      const job: Job = { need, apply };
      budget.queue.push(job);
      scheduleFlush(budget);
      return () => {
        const index = budget.queue.indexOf(job);
        if (index >= 0) budget.queue.splice(index, 1);
      };
    },
  };
  budgets.add(budget);
  return budget;
}

function finish(budget: Budget) {
  if (budget.drained || budget.queue.length > 0) return;
  budget.warm = true;
  budget.drained = true;
  budget.notifyDrained?.();
}

function scheduleFlush(budget: Budget) {
  if (budget.scheduled || budget.paused) return;
  budget.scheduled = true;

  const run = (deadline?: IdleDeadline) => {
    budget.scheduled = false;
    if (budget.paused) return;
    if (!budget.foreground && foregroundBusy()) {
      window.setTimeout(() => scheduleFlush(budget), 80);
      return;
    }
    if (!budget.foreground && deadline && deadline.timeRemaining() < 8 && !deadline.didTimeout) {
      scheduleFlush(budget);
      return;
    }

    const step = budget.foreground ? FOREGROUND_STEP : BACKGROUND_STEP;
    let left = step;
    const grants: Array<{ apply: (grant: number) => void; grant: number }> = [];
    while (left > 0 && budget.queue.length > 0) {
      const job = budget.queue[0];
      const grant = Math.min(left, job.need);
      if (grant <= 0) break;
      job.need -= grant;
      left -= grant;
      grants.push({ apply: job.apply, grant });
      if (job.need <= 0) budget.queue.shift();
      else break;
    }
    for (const item of grants) item.apply(item.grant);
    if (budget.queue.length === 0) finish(budget);
    else scheduleFlush(budget);
  };

  if (budget.foreground) {
    requestAnimationFrame(() => run());
  } else if (typeof requestIdleCallback === 'function') {
    requestIdleCallback((deadline) => run(deadline), { timeout: 500 });
  } else {
    window.setTimeout(() => run(), 48);
  }
}

export function FieldMountBudget({
  foreground = true,
  onDrained,
  children,
}: {
  foreground?: boolean;
  onDrained?: () => void;
  children: ReactNode;
}) {
  const budgetRef = useRef<Budget | null>(null);
  if (budgetRef.current == null) budgetRef.current = createBudget();
  const budget = budgetRef.current;
  budget.foreground = foreground;
  budget.paused = false;
  const onDrainedRef = useRef(onDrained);
  onDrainedRef.current = onDrained;
  budget.notifyDrained = () => onDrainedRef.current?.();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (budget.queue.length === 0) finish(budget);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [budget, foreground]);

  useEffect(() => {
    return () => {
      budget.paused = true;
      budget.queue.length = 0;
      budgets.delete(budget);
    };
  }, [budget]);

  return createElement(FieldMountBudgetContext.Provider, { value: budget }, children);
}

/** 在额度里的长列表从 0 开始逐帧增加。额度外直接返回总数。 */
export function useProgressiveCount(total: number): number {
  const budget = useContext(FieldMountBudgetContext);
  const [count, setCount] = useState(() => (budget ? 0 : total));

  useEffect(() => {
    if (!budget || count >= total) return;
    return budget.requestMore(total - count, (grant) => {
      setCount((current) => Math.min(total, current + grant));
    });
  }, [budget, count, total]);

  if (!budget) return total;
  return Math.min(count, total);
}
