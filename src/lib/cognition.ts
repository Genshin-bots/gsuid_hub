import type { CognitionAttachment, CognitionNode } from '@/lib/api';

export const WORLD_REF_PREFIX = 'world:';
export const ENV_REF_PREFIX = 'ent:';

export function isWorldHub(node: Pick<CognitionNode, 'ref' | 'scope_key'>): boolean {
  return node.ref.startsWith(WORLD_REF_PREFIX) && node.scope_key === '';
}

export function worldGraphId(node: Pick<CognitionNode, 'id' | 'ref'>): string {
  return node.id != null ? `cog:${node.id}` : `world:${node.ref}`;
}

export function articleGraphId(att: Pick<CognitionAttachment, 'node_id' | 'ref' | 'id' | 'title'>): string {
  return `att:${att.node_id}:${att.ref || att.id || att.title}`;
}

export function entityIdFromEnvRef(ref: string): string | null {
  if (!ref.startsWith(ENV_REF_PREFIX)) return null;
  const id = ref.slice(ENV_REF_PREFIX.length);
  return id || null;
}

export function pluginFromWorldRef(ref: string): string {
  if (!ref.startsWith(WORLD_REF_PREFIX)) return '';
  const rest = ref.slice(WORLD_REF_PREFIX.length);
  const colon = rest.indexOf(':');
  return colon === -1 ? rest : rest.slice(0, colon);
}

export function cognitionHandleHref(handle: string, kind?: string): string | null {
  if (handle.startsWith('to_') || handle.startsWith('sa_')) return '/ai-tool-outputs';
  if (handle.startsWith('res_') || kind === 'artifact') return '/ai-artifacts';
  if (
    handle.startsWith('kb_') ||
    kind === 'knowledge'
  ) {
    return '/ai-knowledge';
  }
  if (
    kind === 'episode' ||
    kind === 'preference' ||
    kind === 'entity' ||
    kind === 'self_note'
  ) {
    return '/ai-memory';
  }
  return null;
}

export function nodeHref(node: Pick<CognitionNode, 'handle' | 'kind'>): string | null {
  return cognitionHandleHref(node.handle, node.kind);
}

export function attachmentHref(att: Pick<CognitionAttachment, 'handle'>): string | null {
  return cognitionHandleHref(att.handle);
}

export function hubForEntity(
  entityId: string,
  entityName: string,
  nodes: CognitionNode[],
): CognitionNode | null {
  const hubs = nodes.filter(isWorldHub);
  const env = nodes.find((n) => entityIdFromEnvRef(n.ref) === entityId);
  if (env?.canon) {
    return hubs.find((h) => h.ref === env.canon) ?? null;
  }
  const norm = entityName.trim().toLowerCase();
  if (!norm) return null;
  const hits = hubs.filter((h) => h.title.trim().toLowerCase() === norm);
  return hits.length === 1 ? hits[0] : null;
}

export function mergeCognitionNodes(...lists: Array<CognitionNode[] | undefined>): CognitionNode[] {
  const byKey = new Map<string, CognitionNode>();
  for (const list of lists) {
    if (!list) continue;
    for (const node of list) {
      const key = node.id != null ? `id:${node.id}` : `${node.kind}:${node.ref}`;
      const prev = byKey.get(key);
      if (!prev) {
        byKey.set(key, node);
        continue;
      }
      const prevAtt = prev.attachments?.length ?? 0;
      const nextAtt = node.attachments?.length ?? 0;
      byKey.set(key, nextAtt >= prevAtt ? node : prev);
    }
  }
  return [...byKey.values()];
}

export function isCognitionBackendMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('预保留路径名') ||
    msg.includes('路由未注册') ||
    msg.includes('Not Found') ||
    /HTTP Error:\s*404/i.test(msg)
  );
}
