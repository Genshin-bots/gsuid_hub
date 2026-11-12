import { aiStatisticsApi, type SessionLogEntry } from '@/lib/api';

export interface CostUnit {
  model: string;
  inp: number;
  out: number;
  cr: number;
  cw: number;
}

export interface SessionUsage {
  inp: number;
  out: number;
  cr: number;
  cw: number;
  runs: number;
  pct: number | null;
  costUnits: CostUnit[];
}

function asNum(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * 按模型合并用量。由于 LLM 按百万 Token 线性计价，同一模型的多次调用无论几千轮，
 * 合并后计费结果在数学上完全等价，可将网络负载与后端计算从 O(N 轮) 压缩至 O(M 模型数，通常 1~2)。
 */
export function groupCostUnitsByModel(units: CostUnit[]): CostUnit[] {
  const map = new Map<string, CostUnit>();
  for (const u of units) {
    if (!u.model) continue;
    const existing = map.get(u.model);
    if (!existing) {
      map.set(u.model, { ...u });
    } else {
      existing.inp += u.inp;
      existing.out += u.out;
      existing.cr += u.cr;
      existing.cw += u.cw;
    }
  }
  return Array.from(map.values());
}

/**
 * 从会话 entries 抽取整 session 的用量（输入、输出、缓存读写、命中率）及用于计价的 CostUnit 列表。
 */
export function extractSessionUsage(entries: SessionLogEntry[]): SessionUsage {
  let inp = 0;
  let out = 0;
  let cr = 0;
  let cw = 0;
  let runs = 0;

  // 1. 统计总量：优先以各轮的 token_usage 为准（代表结算总量，避免叠加 step 重复计数）
  let hasTokenUsage = false;
  for (const e of entries) {
    if (e.type !== 'token_usage') continue;
    hasTokenUsage = true;
    const d = (e.data || {}) as Record<string, unknown>;
    inp += asNum(d.input_tokens);
    out += asNum(d.output_tokens);
    cr += asNum(d.cache_read_tokens);
    cw += asNum(d.cache_write_tokens);
    runs += 1;
  }

  // 兼容无 token_usage 仅有 step_usage 的日志
  if (!hasTokenUsage) {
    for (const e of entries) {
      if (e.type !== 'step_usage') continue;
      const d = (e.data || {}) as Record<string, unknown>;
      inp += asNum(d.input_tokens);
      out += asNum(d.output_tokens);
      cr += asNum(d.cache_read_tokens);
      cw += asNum(d.cache_write_tokens);
      runs += 1;
    }
  }

  // 2. 抽取计价单元列表（按 run 隔离）：
  // 每轮优先收集内部的 step_usage（反映每步实际调用的真实模型与用量）；
  // 若某轮无 step_usage，则收集该轮的 token_usage。
  const costUnits: CostUnit[] = [];
  let curRunSteps: CostUnit[] = [];
  let curRunTokenUsage: CostUnit | null = null;
  let inRun = false;

  const flushCurrentRun = () => {
    if (curRunSteps.length > 0) {
      costUnits.push(...curRunSteps);
    } else if (curRunTokenUsage) {
      costUnits.push(curRunTokenUsage);
    }
    curRunSteps = [];
    curRunTokenUsage = null;
  };

  for (const e of entries) {
    const d = (e.data || {}) as Record<string, unknown>;
    if (e.type === 'run_start') {
      if (inRun) flushCurrentRun();
      inRun = true;
    } else if (e.type === 'run_end') {
      if (inRun) {
        flushCurrentRun();
        inRun = false;
      }
    } else if (e.type === 'step_usage') {
      const model = asStr(d.model_name);
      if (model) {
        curRunSteps.push({
          model,
          inp: asNum(d.input_tokens),
          out: asNum(d.output_tokens),
          cr: asNum(d.cache_read_tokens),
          cw: asNum(d.cache_write_tokens),
        });
      }
    } else if (e.type === 'token_usage') {
      const model = asStr(d.model_name);
      if (model) {
        curRunTokenUsage = {
          model,
          inp: asNum(d.input_tokens),
          out: asNum(d.output_tokens),
          cr: asNum(d.cache_read_tokens),
          cw: asNum(d.cache_write_tokens),
        };
      }
    }
  }
  if (inRun || curRunSteps.length > 0 || curRunTokenUsage) {
    flushCurrentRun();
  }

  // 若日志无 run_start/run_end 包裹，扁平扫描兜底
  if (costUnits.length === 0) {
    for (const e of entries) {
      const d = (e.data || {}) as Record<string, unknown>;
      if (e.type === 'step_usage' || e.type === 'token_usage') {
        const model = asStr(d.model_name);
        if (model) {
          costUnits.push({
            model,
            inp: asNum(d.input_tokens),
            out: asNum(d.output_tokens),
            cr: asNum(d.cache_read_tokens),
            cw: asNum(d.cache_write_tokens),
          });
        }
      }
    }
  }

  const pct = inp > 0 ? Math.round((cr / inp) * 100) : null;
  return { inp, out, cr, cw, runs, pct, costUnits: groupCostUnitsByModel(costUnits) };
}

// 费用估算缓存：模型+用量相同的请求只问一次后端（Promise 级缓存，并发 hover 去重）
export const costCache = new Map<string, Promise<number | null>>();

export function estimateCostOnce(
  model: string,
  inp: number,
  out: number,
  cr: number,
  cw: number,
): Promise<number | null> {
  const key = `${model}|${inp}|${out}|${cr}|${cw}`;
  let p = costCache.get(key);
  if (!p) {
    p = aiStatisticsApi
      .estimateCost({
        model,
        input_tokens: inp,
        output_tokens: out,
        cache_read_tokens: cr,
        cache_write_tokens: cw,
      })
      .then((d) => (d && typeof d.cost === 'number' ? d.cost : 0))
      // 旧后端无此接口 → 返回 null，费用项不显示
      .catch(() => null);
    costCache.set(key, p);
  }
  return p;
}

export function estimateCosts(units: CostUnit[]): Promise<number | null> {
  // 先按模型聚合用量：数千轮对话如果使用同一模型，合并为 1 条请求，消除海量计价单位的网络与计算负担
  const validUnits = groupCostUnitsByModel(
    units.filter(
      (u) => (u.inp > 0 || u.out > 0 || u.cr > 0 || u.cw > 0) && Boolean(u.model),
    ),
  );
  if (validUnits.length === 0) return Promise.resolve(null);

  const missing: CostUnit[] = [];
  for (const u of validUnits) {
    const key = `${u.model}|${u.inp}|${u.out}|${u.cr}|${u.cw}`;
    if (!costCache.has(key)) {
      missing.push(u);
    }
  }

  if (missing.length === 1) {
    estimateCostOnce(
      missing[0].model,
      missing[0].inp,
      missing[0].out,
      missing[0].cr,
      missing[0].cw,
    );
  } else if (missing.length > 1) {
    const batchPayload = missing.map((u) => ({
      model: u.model,
      input_tokens: u.inp,
      output_tokens: u.out,
      cache_read_tokens: u.cr,
      cache_write_tokens: u.cw,
    }));
    const batchPromise = aiStatisticsApi
      .estimateCostBatch(batchPayload)
      .then((res) => {
        if (res && res.data && Array.isArray(res.data.costs)) {
          return res.data.costs;
        }
        return null;
      })
      .catch(() => null);

    missing.forEach((u, idx) => {
      const key = `${u.model}|${u.inp}|${u.out}|${u.cr}|${u.cw}`;
      const itemPromise = batchPromise.then((costs) => {
        if (costs && typeof costs[idx] === 'number') {
          return costs[idx];
        }
        return estimateCostOnce(u.model, u.inp, u.out, u.cr, u.cw);
      });
      costCache.set(key, itemPromise);
    });
  }

  const promises = validUnits.map((u) => {
    const key = `${u.model}|${u.inp}|${u.out}|${u.cr}|${u.cw}`;
    return costCache.get(key) ?? Promise.resolve(null);
  });

  return Promise.all(promises).then((vals) => {
    if (vals.every((v) => v === null)) return null;
    return vals.reduce<number>((s, v) => s + (v ?? 0), 0);
  });
}

// 与 /ai-statistics 同口径：USD 按用户的币种设置折算（同一对 localStorage key）
export function formatEstimatedCost(usd: number): string {
  let cur = 'CNY';
  let rate = 7.2;
  try {
    const c = localStorage.getItem('gsuid_stat_currency');
    if (c === 'USD' || c === 'CNY') cur = c;
    const r = parseFloat(localStorage.getItem('gsuid_stat_cny_rate') || '');
    if (!Number.isNaN(r) && r > 0) rate = r;
  } catch {
    // localStorage 不可用（隐私模式）用默认 CNY / 7.2
  }
  const val = cur === 'CNY' ? usd * rate : usd;
  const sym = cur === 'CNY' ? '¥' : '$';
  return val < 0.01 ? `${sym}${val.toFixed(4)}` : `${sym}${val.toFixed(2)}`;
}
