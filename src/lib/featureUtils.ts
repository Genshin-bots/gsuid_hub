/**
 * Pure helpers for P0–P2 console features (unit-tested, no React deps).
 */

/** Detect tools that are registered but likely never recalled by vector search. */
export function isEmptyToolDescription(description: string | null | undefined): boolean {
  if (description == null) return true;
  return description.trim().length === 0;
}

export type ToolDiagnosticLevel = 'ok' | 'warn' | 'error';

export interface ToolDiagnostic {
  level: ToolDiagnosticLevel;
  reasons: string[];
}

export function diagnoseTool(tool: {
  name: string;
  description?: string | null;
  category?: string | null;
}): ToolDiagnostic {
  const reasons: string[] = [];
  if (isEmptyToolDescription(tool.description)) {
    reasons.push('empty_description');
  }
  if (!tool.name?.trim()) {
    reasons.push('empty_name');
  }
  if (reasons.includes('empty_description')) {
    return { level: 'error', reasons };
  }
  if (tool.category === 'meta') {
    reasons.push('meta_not_vector_searchable');
    return { level: 'warn', reasons };
  }
  return { level: 'ok', reasons };
}

export function countToolDiagnostics(
  tools: Array<{ name: string; description?: string | null; category?: string | null }>,
): { total: number; emptyDescription: number; meta: number; ok: number } {
  let emptyDescription = 0;
  let meta = 0;
  let ok = 0;
  for (const tool of tools) {
    const d = diagnoseTool(tool);
    if (d.reasons.includes('empty_description')) emptyDescription += 1;
    else if (d.reasons.includes('meta_not_vector_searchable')) meta += 1;
    else ok += 1;
  }
  return { total: tools.length, emptyDescription, meta, ok };
}

/** Validate dual-route memory search form before calling API. */
export function validateMemorySearchInput(input: {
  query: string;
  groupId: string;
  topK?: number;
}): { ok: true } | { ok: false; error: 'empty_query' | 'empty_group' | 'bad_top_k' } {
  const query = input.query.trim();
  const groupId = input.groupId.trim();
  if (!query) return { ok: false, error: 'empty_query' };
  if (!groupId) return { ok: false, error: 'empty_group' };
  if (input.topK != null && (input.topK < 1 || input.topK > 50 || !Number.isFinite(input.topK))) {
    return { ok: false, error: 'bad_top_k' };
  }
  return { ok: true };
}

/** ISO date YYYY-MM-DD in local timezone. */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive date range ending today for the last N days. */
export function dateRangeLastDays(days: number, now = new Date()): { start: string; end: string } {
  const safeDays = Math.max(1, Math.min(366, Math.floor(days) || 1));
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (safeDays - 1));
  return { start: formatLocalDate(start), end: formatLocalDate(end) };
}

export interface MemoryPipelineStats {
  observations: number;
  ingestions: number;
  ingestion_errors: number;
  retrievals: number;
  entities_created: number;
  edges_created: number;
  episodes_created: number;
}

/** Derive a simple health ratio for memory pipeline cards. */
export function memoryIngestHealth(stats: Partial<MemoryPipelineStats> | null | undefined): {
  ratio: number;
  hasErrors: boolean;
  label: 'healthy' | 'degraded' | 'empty';
} {
  const observations = stats?.observations ?? 0;
  const ingestions = stats?.ingestions ?? 0;
  const errors = stats?.ingestion_errors ?? 0;
  if (observations === 0 && ingestions === 0) {
    return { ratio: 0, hasErrors: errors > 0, label: 'empty' };
  }
  const ratio = observations > 0 ? Math.min(1, ingestions / observations) : ingestions > 0 ? 1 : 0;
  if (errors > 0 || ratio < 0.5) {
    return { ratio, hasErrors: errors > 0, label: 'degraded' };
  }
  return { ratio, hasErrors: false, label: 'healthy' };
}

/** Extract daily token totals from statistics history payload. */
export function extractHistoryTokenSeries(
  history: Array<{
    date: string;
    data?: {
      token_usage?: { total_input_tokens?: number; total_output_tokens?: number };
      efficiency?: {
        user_turn_count?: number;
        agent_run_count?: number;
        avg_tokens_per_user_turn?: number;
        avg_tokens_per_agent_run?: number;
        avg_agent_runs_per_user_turn?: number;
      };
    };
  }>,
): Array<{
  date: string;
  input: number;
  output: number;
  total: number;
  userTurns: number;
  agentRuns: number;
  avgPerTurn: number;
  avgPerRun: number;
  avgRunsPerTurn: number;
}> {
  return history.map((row) => {
    const input = row.data?.token_usage?.total_input_tokens ?? 0;
    const output = row.data?.token_usage?.total_output_tokens ?? 0;
    const eff = row.data?.efficiency;
    return {
      date: row.date,
      input,
      output,
      total: input + output,
      userTurns: eff?.user_turn_count ?? 0,
      agentRuns: eff?.agent_run_count ?? 0,
      avgPerTurn: eff?.avg_tokens_per_user_turn ?? 0,
      avgPerRun: eff?.avg_tokens_per_agent_run ?? 0,
      avgRunsPerTurn: eff?.avg_agent_runs_per_user_turn ?? 0,
    };
  });
}

/** Aggregate hourly performance range rows by date. */
export function aggregatePerformanceByDate(
  rows: Array<{
    date: string;
    request_count: number;
    ttft_avg_ms: number;
    tps_avg: number;
  }>,
): Array<{ date: string; requests: number; ttftAvg: number; tpsAvg: number }> {
  const map = new Map<string, { requests: number; ttftSum: number; tpsSum: number; n: number }>();
  for (const row of rows) {
    const cur = map.get(row.date) ?? { requests: 0, ttftSum: 0, tpsSum: 0, n: 0 };
    cur.requests += row.request_count || 0;
    cur.ttftSum += row.ttft_avg_ms || 0;
    cur.tpsSum += row.tps_avg || 0;
    cur.n += 1;
    map.set(row.date, cur);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      requests: v.requests,
      ttftAvg: v.n ? v.ttftSum / v.n : 0,
      tpsAvg: v.n ? v.tpsSum / v.n : 0,
    }));
}

/** Group profile state-store scope used by gsuid_core. */
export const GROUP_PROFILE_STATE_SCOPE = '__gscore_group_profile__';

export function isGroupProfileScope(scope: string): boolean {
  return scope === GROUP_PROFILE_STATE_SCOPE;
}

/** Normalize group profile JSON for UI. */
export function normalizeGroupProfile(
  raw: unknown,
  scopeKey: string,
): {
  scope_key: string;
  tag_counts: Record<string, number>;
  term_mappings: Record<string, string>;
  member_alias_ids: Record<string, string[]>;
  last_updated: string;
} {
  const empty = {
    scope_key: scopeKey,
    tag_counts: {} as Record<string, number>,
    term_mappings: {} as Record<string, string>,
    member_alias_ids: {} as Record<string, string[]>,
    last_updated: '',
  };
  if (!raw || typeof raw !== 'object') return empty;
  const obj = raw as Record<string, unknown>;
  const tag_counts =
    obj.tag_counts && typeof obj.tag_counts === 'object' && !Array.isArray(obj.tag_counts)
      ? (obj.tag_counts as Record<string, number>)
      : {};
  const term_mappings =
    obj.term_mappings && typeof obj.term_mappings === 'object' && !Array.isArray(obj.term_mappings)
      ? (obj.term_mappings as Record<string, string>)
      : {};
  const member_alias_ids: Record<string, string[]> = {};
  const rawAliases = obj.member_alias_ids;
  if (rawAliases && typeof rawAliases === 'object' && !Array.isArray(rawAliases)) {
    for (const [k, v] of Object.entries(rawAliases as Record<string, unknown>)) {
      if (Array.isArray(v)) member_alias_ids[k] = v.map(String);
      else if (v != null) member_alias_ids[k] = [String(v)];
    }
  }
  return {
    scope_key: typeof obj.scope_key === 'string' ? obj.scope_key : scopeKey,
    tag_counts,
    term_mappings,
    member_alias_ids,
    last_updated: typeof obj.last_updated === 'string' ? obj.last_updated : '',
  };
}

export function filterToolsByDiagnostic(
  tools: Array<{ name: string; description?: string | null; category?: string | null }>,
  mode: 'all' | 'issues' | 'empty_description',
): typeof tools {
  if (mode === 'all') return tools;
  return tools.filter((tool) => {
    const d = diagnoseTool(tool);
    if (mode === 'empty_description') return d.reasons.includes('empty_description');
    return d.level !== 'ok';
  });
}

// ── Ops diagnostics helpers ──────────────────────────────────────

export type TriggerOutcome =
  | 'would_enter_ai'
  | 'no_response'
  | 'blocked'
  | 'unknown';

export function summarizeTriggerReplay(data: {
  outcome?: string;
  reason?: string;
  trigger_type?: string;
  steps?: Array<{ step: string; pass: boolean }>;
}): {
  outcome: TriggerOutcome;
  failedStep: string | null;
  passedSteps: number;
  totalSteps: number;
  labelKey: string;
} {
  const outcome = (data.outcome as TriggerOutcome) || 'unknown';
  const steps = data.steps ?? [];
  const failed = steps.find((s) => !s.pass);
  return {
    outcome,
    failedStep: failed?.step ?? data.reason ?? null,
    passedSteps: steps.filter((s) => s.pass).length,
    totalSteps: steps.length,
    labelKey:
      outcome === 'would_enter_ai'
        ? 'wouldEnterAi'
        : outcome === 'blocked'
          ? 'blocked'
          : outcome === 'no_response'
            ? 'noResponse'
            : 'unknown',
  };
}

export function multimodalHealthLevel(util: number, workerRunning: boolean): 'ok' | 'warn' | 'critical' {
  if (!workerRunning && util > 0) return 'critical';
  if (util >= 0.85) return 'critical';
  if (util >= 0.5 || !workerRunning) return 'warn';
  return 'ok';
}

export function botConnectionSummary(items: Array<{ connected: boolean }>): {
  total: number;
  connected: number;
  offline: number;
  allOnline: boolean;
} {
  const total = items.length;
  const connected = items.filter((b) => b.connected).length;
  return {
    total,
    connected,
    offline: total - connected,
    allOnline: total > 0 && connected === total,
  };
}

export function validateSnapshotImport(raw: unknown): {
  ok: boolean;
  error?: string;
  snapshot?: Record<string, unknown>;
} {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'not_object' };
  }
  const snap = raw as Record<string, unknown>;
  if (snap.version == null && snap.ai_config == null && snap.access == null) {
    return { ok: false, error: 'missing_fields' };
  }
  return { ok: true, snapshot: snap };
}

export function downloadJsonFilename(prefix: string, now = new Date()): string {
  const stamp = formatLocalDate(now).replace(/-/g, '');
  return `${prefix}-${stamp}.json`;
}

export function oocHitLabel(hit: { category: string; matched: string[] } | null | undefined): string {
  if (!hit) return 'clean';
  return `${hit.category}:${(hit.matched || []).slice(0, 3).join(',')}`;
}

export function sessionIdleBucket(
  idleSeconds: number | null | undefined,
  threshold = 1800,
): 'active' | 'idle' | 'unknown' {
  if (idleSeconds == null || !Number.isFinite(idleSeconds)) return 'unknown';
  return idleSeconds < threshold ? 'active' : 'idle';
}

// ── Batch push image helpers ─────────────────────────────────────
//
// Large base64 must NOT live in the editable textarea (freezes the page).
// Editor keeps short placeholders; payload Map holds data URLs; expand only
// for preview + BatchPush submit.

export type BatchPushImageAsset = {
  dataUrl: string;
  width: number;
  height: number;
};

/** Whether a File is a usable image payload for batch-push body. */
export function isImageFile(file: File | Blob | null | undefined): boolean {
  if (!file) return false;
  const type = 'type' in file ? file.type : '';
  return typeof type === 'string' && type.startsWith('image/');
}

function clampPositiveInt(n: number, fallback = 1): number {
  const v = Math.round(Number.isFinite(n) ? n : fallback);
  return Math.max(1, v);
}

/**
 * Build the HTML img tag the BatchPush backend expects.
 * Backend: `base64_data = "base64://" + src.split(",")[-1]` and requires width/height strings.
 */
export function buildBatchPushImageTag(
  dataUrl: string,
  width: number,
  height: number,
): string {
  const w = clampPositiveInt(width);
  const h = clampPositiveInt(height);
  // Ensure data URL still has a comma so split(",")[-1] yields pure base64.
  const src = dataUrl.includes(',') ? dataUrl : `data:image/png;base64,${dataUrl}`;
  return `<img src="${src}" width="${w}" height="${h}" />`;
}

/** Short editor-only img tag (no base64). */
export function buildBatchPushImagePlaceholder(
  id: string,
  width: number,
  height: number,
): string {
  const safeId = String(id).replace(/[^a-zA-Z0-9_-]/g, '');
  const w = clampPositiveInt(width);
  const h = clampPositiveInt(height);
  return `<img data-bp-id="${safeId}" width="${w}" height="${h}" alt="image" />`;
}

export function makeBatchPushImageId(): string {
  return `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const BP_PLACEHOLDER_RE =
  /<img\b[^>]*\bdata-bp-id\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
const BP_DATA_URL_IMG_RE =
  /<img\b[^>]*\bsrc\s*=\s*["'](data:image\/[^"']+)["'][^>]*\/?>/gi;

/** Expand editor placeholders into backend-ready full img tags. */
export function expandBatchPushBody(
  text: string,
  assets: Record<string, BatchPushImageAsset>,
): string {
  if (!text) return text;
  return text.replace(BP_PLACEHOLDER_RE, (full, id: string) => {
    const asset = assets[id];
    if (!asset?.dataUrl) return full;
    return buildBatchPushImageTag(asset.dataUrl, asset.width, asset.height);
  });
}

/**
 * If the user pasted/typed full data-URL `<img src="data:image...">` tags,
 * extract them into assets and replace with short placeholders so the textarea stays light.
 */
export function normalizeBatchPushBodyImages(
  text: string,
  existingAssets: Record<string, BatchPushImageAsset> = {},
): { text: string; assets: Record<string, BatchPushImageAsset>; extracted: number } {
  const assets: Record<string, BatchPushImageAsset> = { ...existingAssets };
  let extracted = 0;
  if (!text || !text.includes('data:image')) {
    return { text, assets, extracted: 0 };
  }
  const next = text.replace(BP_DATA_URL_IMG_RE, (full, dataUrl: string) => {
    // Already a placeholder? (shouldn't also have data URL src)
    const existingId = /\bdata-bp-id\s*=\s*["']([^"']+)["']/i.exec(full)?.[1];
    if (existingId && assets[existingId]) {
      return buildBatchPushImagePlaceholder(
        existingId,
        assets[existingId].width,
        assets[existingId].height,
      );
    }
    const wMatch = /\bwidth\s*=\s*["']?(\d+)/i.exec(full);
    const hMatch = /\bheight\s*=\s*["']?(\d+)/i.exec(full);
    const width = wMatch ? Number(wMatch[1]) : 1;
    const height = hMatch ? Number(hMatch[1]) : 1;
    const id = makeBatchPushImageId();
    assets[id] = {
      dataUrl: String(dataUrl),
      width: clampPositiveInt(width),
      height: clampPositiveInt(height),
    };
    extracted += 1;
    return buildBatchPushImagePlaceholder(id, width, height);
  });
  return { text: next, assets, extracted };
}

/** Drop assets no longer referenced by placeholders (free large base64 after delete). */
export function pruneBatchPushImageAssets(
  text: string,
  assets: Record<string, BatchPushImageAsset>,
): Record<string, BatchPushImageAsset> {
  const used = new Set<string>();
  BP_PLACEHOLDER_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(BP_PLACEHOLDER_RE.source, 'gi');
  while ((m = re.exec(text)) !== null) {
    used.add(m[1]);
  }
  const next: Record<string, BatchPushImageAsset> = {};
  for (const id of used) {
    if (assets[id]) next[id] = assets[id];
  }
  return next;
}

/** Insert text at a textarea selection range. */
export function insertTextAt(
  value: string,
  insert: string,
  start: number,
  end: number,
): { next: string; caret: number } {
  const s = Math.max(0, Math.min(start, value.length));
  const e = Math.max(s, Math.min(end, value.length));
  const next = value.slice(0, s) + insert + value.slice(e);
  return { next, caret: s + insert.length };
}

/** Collect image Files from a DataTransfer (paste / drop). */
export function collectImageFilesFromDataTransfer(
  dt: DataTransfer | null | undefined,
): File[] {
  if (!dt) return [];
  const out: File[] = [];
  if (dt.files && dt.files.length > 0) {
    for (let i = 0; i < dt.files.length; i += 1) {
      const f = dt.files.item(i);
      if (f && isImageFile(f)) out.push(f);
    }
  }
  if (out.length > 0) return out;
  // Some browsers put paste images only in items
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i += 1) {
      const item = dt.items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const f = item.getAsFile();
        if (f) out.push(f);
      }
    }
  }
  return out;
}

// ── Dashboard command colors ─────────────────────────────────────
// Hardcoded mock name maps fall back to gray for real command names.
// Use a stable hash → palette so each command keeps a distinct color.

/** Vibrant palette (no gray) for per-command bars. */
export const COMMAND_COLOR_PALETTE = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#84cc16', // lime
  '#e11d48', // rose
  '#0ea5e9', // sky
  '#a855f7', // purple
  '#eab308', // yellow
  '#10b981', // emerald
  '#f43f5e', // rose-2
  '#d946ef', // fuchsia
  '#2dd4bf', // teal-2
  '#fb923c', // orange-2
] as const;

/** Optional well-known overrides (legacy mock names + common labels). */
export const COMMAND_COLOR_OVERRIDES: Record<string, string> = {
  全天候: '#3b82f6',
  删除自选: '#ef4444',
  加入自选: '#22c55e',
  我的自选: '#f59e0b',
  mr: '#8b5cf6',
  添加自选: '#06b6d4',
  信息: '#ec4899',
  其他命令: '#64748b',
  other: '#64748b',
  Other: '#64748b',
};

/** djb2-ish stable hash for palette indexing. */
export function hashCommandName(name: string): number {
  let h = 5381;
  const s = String(name ?? '');
  for (let i = 0; i < s.length; i += 1) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/**
 * Color for a command name: override map first, else stable palette pick.
 * Same name always returns the same color across charts / reloads.
 */
export function getCommandColor(command: string): string {
  const key = String(command ?? '').trim();
  if (!key) return COMMAND_COLOR_PALETTE[0];
  if (COMMAND_COLOR_OVERRIDES[key]) return COMMAND_COLOR_OVERRIDES[key];
  const idx = hashCommandName(key) % COMMAND_COLOR_PALETTE.length;
  return COMMAND_COLOR_PALETTE[idx];
}

/**
 * Collect stacked-bar command keys from group/user trigger rows.
 * Skips id columns (`group`, `user`, …).
 */
export function collectCommandKeysFromTriggerRows(
  rows: Array<Record<string, unknown>>,
  idKeys: readonly string[] = ['group', 'user'],
): string[] {
  const idSet = new Set(idKeys);
  const keys = new Set<string>();
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    for (const k of Object.keys(row)) {
      if (!idSet.has(k)) keys.add(k);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

/**
 * Compact metric for calendar day cells (e.g. 3M, 12.5k, 42).
 * Keeps labels short enough for 2.75rem day buttons.
 */
export function formatCompactMetric(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}k`;
  }
  if (abs < 1_000_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : Number(v.toFixed(1))}M`;
  }
  const v = n / 1_000_000_000;
  return `${Number(v.toFixed(1))}B`;
}

/** Pick latest date (YYYY-MM-DD) with metric > 0; null if none. */
export function latestDateWithMetric(
  metrics: Record<string, number>,
): string | null {
  const dates = Object.keys(metrics)
    .filter((d) => (metrics[d] ?? 0) > 0)
    .sort();
  return dates.length > 0 ? dates[dates.length - 1]! : null;
}
