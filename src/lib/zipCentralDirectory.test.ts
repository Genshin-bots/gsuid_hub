import { describe, expect, it } from 'vitest';
import { readZipDirectory } from './zipCentralDirectory';

// 手写 zip 构造器：只写 STORED 本地头 + 中央目录 + EOCD（按需拼 ZIP64 extra）。
const encoder = new TextEncoder();

interface TestEntryOpts {
  name: string;
  data?: Uint8Array;
  isDir?: boolean;
  method?: number;
  isSymlink?: boolean;
  encrypted?: boolean;
  zip64?: boolean;
}

function u16(v: number): Uint8Array {
  const b = new Uint8Array(2);
  new DataView(b.buffer).setUint16(0, v, true);
  return b;
}

function u32(v: number): Uint8Array {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, v, true);
  return b;
}

function u64(v: number): Uint8Array {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, BigInt(v), true);
  return b;
}

function cat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function buildZip(entries: TestEntryOpts[]): Blob {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    const nameBytes = encoder.encode(e.name);
    const data = e.data ?? new Uint8Array(0);
    const flags = e.encrypted ? 0x0001 : 0x0800;
    const method = e.method ?? 0;
    const extAttr = e.isSymlink ? (0xa000 << 16) | 0o777 : e.isDir ? 0o40755 << 16 : 0o100644 << 16;

    const localExtra = e.zip64
      ? cat([u16(0x0001), u16(16), u64(data.length), u64(data.length)])
      : new Uint8Array(0);
    const localHeader = cat([
      u32(0x04034b50),
      u16(20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(e.zip64 ? 0xffffffff : data.length),
      u32(e.zip64 ? 0xffffffff : data.length),
      u16(nameBytes.length),
      u16(localExtra.length),
      nameBytes,
      localExtra,
      data,
    ]);

    const centralExtra = e.zip64
      ? cat([u16(0x0001), u16(24), u64(data.length), u64(data.length), u64(offset)])
      : new Uint8Array(0);
    const central = cat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(0),
      u32(e.zip64 ? 0xffffffff : data.length),
      u32(e.zip64 ? 0xffffffff : data.length),
      u16(nameBytes.length),
      u16(centralExtra.length),
      u16(0),
      u16(0),
      u16(0),
      u32(extAttr),
      u32(e.zip64 ? 0xffffffff : offset),
      nameBytes,
      centralExtra,
    ]);

    localParts.push(localHeader);
    centralParts.push(central);
    offset += localHeader.length;
  }

  const cdOffset = offset;
  const cd = cat(centralParts);
  const eocd = cat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(cd.length),
    u32(cdOffset),
    u16(0),
  ]);
  return new Blob([cat([...localParts, cd, eocd])]);
}

function manifestJson(extra?: Record<string, unknown>): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      format: 'gscore-backup',
      format_version: 1,
      file_id: 'NowFile-2026-11-16',
      roots: ['GsData.db'],
      file_count: 1,
      total_bytes: 4,
      ...extra,
    }),
  );
}

describe('readZipDirectory', () => {
  it('解析 STORED 条目、目录项与 UTF-8 文件名', async () => {
    const zip = buildZip([
      { name: 'a.txt', data: encoder.encode('hello') },
      { name: '中文目录/', isDir: true },
      { name: '中文目录/文件.bin', data: encoder.encode('x'.repeat(9)) },
    ]);
    const dir = await readZipDirectory(zip);
    expect(dir.entries).toHaveLength(3);
    expect(dir.entries[0].path).toBe('a.txt');
    expect(dir.entries[0].size).toBe(5);
    expect(dir.entries[0].is_dir).toBe(false);
    expect(dir.entries[1].is_dir).toBe(true);
    expect(dir.entries[2].path).toBe('中文目录/文件.bin');
    expect(dir.manifest).toBeNull();
  });

  it('识别 symlink 与加密标志', async () => {
    const zip = buildZip([
      { name: 'link', isSymlink: true },
      { name: 'secret.txt', data: encoder.encode('s'), encrypted: true },
    ]);
    const dir = await readZipDirectory(zip);
    expect(dir.entries[0].is_symlink).toBe(true);
    expect(dir.entries[1].encrypted).toBe(true);
  });

  it('从 ZIP64 extra 0x0001 读出真实大小', async () => {
    const zip = buildZip([{ name: 'big.bin', data: encoder.encode('1234567'), zip64: true }]);
    const dir = await readZipDirectory(zip);
    expect(dir.entries[0].size).toBe(7);
    expect(dir.entries[0].compressedSize).toBe(7);
  });

  it('STORED 清单可直接读出 JSON', async () => {
    const zip = buildZip([
      { name: 'a.txt', data: encoder.encode('a') },
      { name: 'gscore_backup_manifest.json', data: manifestJson() },
    ]);
    const dir = await readZipDirectory(zip);
    const m = dir.manifest as { format?: string; file_id?: string } | null;
    expect(m?.format).toBe('gscore-backup');
    expect(m?.file_id).toBe('NowFile-2026-11-16');
  });

  it('非 STORED 清单按无清单处理', async () => {
    const zip = buildZip([
      { name: 'gscore_backup_manifest.json', data: manifestJson(), method: 8 },
    ]);
    const dir = await readZipDirectory(zip);
    expect(dir.manifest).toBeNull();
  });

  it('无清单返回 null', async () => {
    const zip = buildZip([{ name: 'a.txt', data: encoder.encode('a') }]);
    const dir = await readZipDirectory(zip);
    expect(dir.manifest).toBeNull();
  });

  it('非 zip 内容抛错', async () => {
    await expect(readZipDirectory(new Blob([encoder.encode('not a zip')]))).rejects.toThrow();
  });
});
