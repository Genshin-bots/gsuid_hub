import type {
  PersonaBackupInfo,
  PersonaJobKind,
  PersonaJobStep,
  PersonaJobStepKey,
  PersonaJobView,
  PersonaResetItemKey,
  PersonaResetItemPreview,
  PersonaResetPreview,
  PersonaRestorePreview,
} from './api';

/** demo 模式的人格重置 / 备份 / 还原：任务进度按经过时间推算，改动不持久化。 */

interface MockJob {
  id: string;
  kind: PersonaJobKind;
  persona: string;
  steps: PersonaJobStepKey[];
  startedAt: number;
  backupFile: string;
  items: PersonaResetItemKey[];
}

const STEP_MS = 1500;
const jobs = new Map<string, MockJob>();
const backupStore = new Map<string, PersonaBackupInfo[]>();

const PREVIEW_ITEMS: PersonaResetItemPreview[] = [
  mockItem('journal', 'persona', true, 42, 'files', 0.6, 180_000),
  mockItem('self_memory', 'persona', true, 1280, 'rows', 2.4, 920_000),
  mockItem('relationship', 'persona', true, 36, 'rows', 0.2, 12_000),
  mockItem('persona_state', 'persona', true, 3, 'keys', 0.1, 2_000),
  mockItem('session_history', 'persona', true, 4, 'sessions', 0, 0, false),
  mockItem('scheduled_tasks', 'persona', false, 2, 'tasks', 0.1, 1_000),
  mockItem('global_group', 'global', false, 5400, 'rows', 8.7, 3_600_000),
  mockItem('global_user', 'global', false, 740, 'rows', 1.4, 372_000),
  mockItem('user_preferences', 'global', false, 120, 'rows', 0.2, 48_000),
];

function mockItem(
  key: PersonaResetItemKey,
  group: 'persona' | 'global',
  checked: boolean,
  count: number,
  unit: PersonaResetItemPreview['unit'],
  seconds: number,
  bytes: number,
  backupSupported = true,
): PersonaResetItemPreview {
  return {
    key,
    group,
    default_checked: checked,
    count,
    unit,
    backup_supported: backupSupported,
    backup_seconds: seconds,
    backup_bytes: bytes,
  };
}

function backupsOf(persona: string): PersonaBackupInfo[] {
  let list = backupStore.get(persona);
  if (!list) {
    list = [
      {
        file: '20261101_210000.zip',
        created_at: Math.floor(Date.UTC(2026, 10, 1, 13, 0, 0) / 1000),
        items: ['journal', 'self_memory', 'relationship', 'persona_state'],
        counts: { journal: 38, self_memory: 1102, relationship: 30, persona_state: 3 },
        size_bytes: 1_048_576,
        embedding_model: 'demo-embedding-small',
      },
    ];
    backupStore.set(persona, list);
  }
  return list;
}

function viewOf(job: MockJob): PersonaJobView {
  const elapsed = Date.now() - job.startedAt;
  const current = Math.floor(elapsed / STEP_MS);
  const finished = current >= job.steps.length;
  const steps: PersonaJobStep[] = job.steps.map((key, index) => {
    const total = key === 'vectors' || key === 'memory' || key === 'import' ? 100 : 0;
    if (index < current) return { key, status: 'done', done: total, total };
    if (index > current) return { key, status: 'pending', done: 0, total };
    const done = total > 0 ? Math.floor(((elapsed % STEP_MS) / STEP_MS) * total) : 0;
    return { key, status: 'running', done, total };
  });
  const remaining = Math.max(0, job.steps.length * STEP_MS - elapsed);
  return {
    job_id: job.id,
    kind: job.kind,
    persona: job.persona,
    status: finished ? 'done' : 'running',
    steps,
    eta_seconds: finished ? 0 : Math.ceil(remaining / 1000),
    error: '',
    backup_file: job.backupFile,
    counts: finished ? Object.fromEntries(job.items.map((key) => [key, 12])) : {},
    started_at: Math.floor(job.startedAt / 1000),
    finished_at: finished ? Math.floor((job.startedAt + job.steps.length * STEP_MS) / 1000) : 0,
  };
}

function activeJobFor(persona: string): PersonaJobView | null {
  for (const job of jobs.values()) {
    const view = viewOf(job);
    if (job.persona === persona && view.status === 'running') return view;
  }
  return null;
}

function newJobId(): string {
  return `demo-${Date.now().toString(36)}`;
}

export function generatePersonaResetPreview(persona: string): PersonaResetPreview {
  return {
    persona,
    items: PREVIEW_ITEMS,
    other_personas: ['早柚', '演示人格B'].filter((name) => name !== persona),
    legacy_self_key: false,
    active_job: activeJobFor(persona),
  };
}

export function startPersonaMockReset(persona: string, body: unknown): { job_id: string } {
  const payload = (body ?? {}) as { items?: PersonaResetItemKey[]; backup?: boolean };
  const items = payload.items ?? [];
  const id = newJobId();
  let backupFile = '';
  if (payload.backup) {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    backupFile = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`;
    backupsOf(persona).unshift({
      file: backupFile,
      created_at: Math.floor(now.getTime() / 1000),
      items: items.filter((key) => key !== 'session_history'),
      counts: Object.fromEntries(items.map((key) => [key, 12])),
      size_bytes: 524_288,
      embedding_model: 'demo-embedding-small',
    });
  }
  const steps: PersonaJobStepKey[] = ['prepare'];
  if (payload.backup) steps.push('backup');
  steps.push(
    'memory',
    'user_preferences',
    'journal',
    'relationship',
    'persona_state',
    'scheduled_tasks',
    'finish',
  );
  jobs.set(id, { id, kind: 'reset', persona, steps, startedAt: Date.now(), backupFile, items });
  return { job_id: id };
}

export function getPersonaMockJob(jobId: string): PersonaJobView | null {
  const job = jobs.get(jobId);
  return job ? viewOf(job) : null;
}

export function resumePersonaMockJob(jobId: string): { job_id: string } {
  return { job_id: jobId };
}

export function getPersonaMockActiveJob(persona: string): PersonaJobView | null {
  return activeJobFor(persona);
}

export function listPersonaMockBackups(persona: string): PersonaBackupInfo[] {
  return backupsOf(persona);
}

export function deletePersonaMockBackup(persona: string, file: string): null {
  backupStore.set(
    persona,
    backupsOf(persona).filter((backup) => backup.file !== file),
  );
  return null;
}

export function generatePersonaRestorePreview(
  persona: string,
  file: string,
): PersonaRestorePreview {
  const backup = backupsOf(persona).find((b) => b.file === file);
  const items = backup?.items ?? [];
  return {
    file,
    items,
    overwrite_counts: Object.fromEntries(items.map((key) => [key, 20])),
    import_counts: backup?.counts ?? {},
    vector_texts: 2400,
    vector_eta_seconds: 48,
    throughput_per_sec: 50,
    embedding_model: 'demo-embedding-small',
    active_job: activeJobFor(persona),
  };
}

export function startPersonaMockRestore(persona: string, body: unknown): { job_id: string } {
  const payload = (body ?? {}) as { items?: PersonaResetItemKey[] };
  const id = newJobId();
  jobs.set(id, {
    id,
    kind: 'restore',
    persona,
    steps: ['prepare', 'clear', 'import', 'files', 'vectors', 'finish'],
    startedAt: Date.now(),
    backupFile: '',
    items: payload.items ?? [],
  });
  return { job_id: id };
}
