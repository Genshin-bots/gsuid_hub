/**
 * 只读 zip 尾部：EOCD → （可选 ZIP64 EOCD）→ 中央目录，几 GB 文件也只读几十 KB～几 MB。
 * 再按 local header 定位读清单文件（STORED 才直接读，压缩的当无清单）。
 */

import type { RestoreEntryInput } from '@/lib/api';

export interface ZipDirEntry extends RestoreEntryInput {
  compressedSize: number;
  method: number;
  localHeaderOffset: number;
}

export interface ZipDirectory {
  entries: ZipDirEntry[];
  manifest: unknown | null;
}

const EOCD_SIG = 0x06054b50;
const EOCD64_SIG = 0x06064b50;
const EOCD64_LOCATOR_SIG = 0x07064b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;
const EOCD_TAIL_MAX = 22 + 0xffff; // EOCD 定长 22 + 注释最长 65535
const ZIP64_EXTRA_ID = 0x0001;
const MANIFEST_NAME = 'gscore_backup_manifest.json';
const S_IFMT = 0xf000;
const S_IFLNK = 0xa000;

const utf8 = new TextDecoder('utf-8');

function num(view: DataView, offset: number): number {
  return Number(view.getBigUint64(offset, true));
}

async function viewOf(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function findEocd(view: DataView): number {
  // 注释内可能含伪签名，从尾往前扫最后一个有效 EOCD
  for (let i = view.byteLength - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) !== EOCD_SIG) continue;
    const commentLen = view.getUint16(i + 20, true);
    if (i + 22 + commentLen === view.byteLength) return i;
  }
  return -1;
}

function parseZip64Extra(
  view: DataView,
  extraStart: number,
  extraLen: number,
  needUncomp: boolean,
  needComp: boolean,
  needOffset: boolean,
): { uncomp: number; comp: number; offset: number } {
  const values: number[] = [];
  let p = extraStart;
  const end = extraStart + extraLen;
  while (p + 4 <= end) {
    const id = view.getUint16(p, true);
    const size = view.getUint16(p + 2, true);
    p += 4;
    if (id === ZIP64_EXTRA_ID) {
      const fieldsEnd = p + size;
      while (p + 8 <= fieldsEnd && values.length < 3) {
        values.push(num(view, p));
        p += 8;
      }
      break;
    }
    p += size;
  }
  const out = { uncomp: 0, comp: 0, offset: 0 };
  let i = 0;
  if (needUncomp) {
    out.uncomp = values[i] ?? 0;
    i += 1;
  }
  if (needComp) {
    out.comp = values[i] ?? 0;
    i += 1;
  }
  if (needOffset) {
    out.offset = values[i] ?? 0;
  }
  return out;
}

export async function readZipDirectory(blob: Blob): Promise<ZipDirectory> {
  const tailSize = Math.min(EOCD_TAIL_MAX, blob.size);
  const tail = await viewOf(blob.slice(blob.size - tailSize));
  const eocdPos = findEocd(tail);
  if (eocdPos < 0) {
    throw new Error('not a zip file');
  }

  let entryCount = tail.getUint16(eocdPos + 10, true);
  let cdSize = tail.getUint32(eocdPos + 12, true);
  let cdOffset = tail.getUint32(eocdPos + 16, true);

  if (entryCount === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) {
    // ZIP64 EOCD locator 定长 20，紧贴 EOCD 之前
    const locatorPos = eocdPos - 20;
    if (locatorPos < 0 || tail.getUint32(locatorPos, true) !== EOCD64_LOCATOR_SIG) {
      throw new Error('zip64 locator not found');
    }
    const eocd64Offset = num(tail, locatorPos + 8);
    const eocd64 = await viewOf(blob.slice(eocd64Offset, eocd64Offset + 56));
    if (eocd64.getUint32(0, true) !== EOCD64_SIG) {
      throw new Error('zip64 eocd not found');
    }
    entryCount = num(eocd64, 32);
    cdSize = num(eocd64, 40);
    cdOffset = num(eocd64, 48);
  }

  const cdView = await viewOf(blob.slice(cdOffset, cdOffset + cdSize));
  const entries: ZipDirEntry[] = [];
  let manifestEntry: ZipDirEntry | null = null;
  let p = 0;
  for (let i = 0; i < entryCount; i += 1) {
    if (p + 46 > cdView.byteLength || cdView.getUint32(p, true) !== CENTRAL_SIG) break;
    const flags = cdView.getUint16(p + 8, true);
    const method = cdView.getUint16(p + 10, true);
    let compSize = cdView.getUint32(p + 20, true);
    let uncompSize = cdView.getUint32(p + 24, true);
    const nameLen = cdView.getUint16(p + 28, true);
    const extraLen = cdView.getUint16(p + 30, true);
    const commentLen = cdView.getUint16(p + 32, true);
    const extAttr = cdView.getUint32(p + 38, true);
    let localOffset = cdView.getUint32(p + 42, true);
    const nameStart = p + 46;

    if (uncompSize === 0xffffffff || compSize === 0xffffffff || localOffset === 0xffffffff) {
      const zip64 = parseZip64Extra(
        cdView,
        nameStart + nameLen,
        extraLen,
        uncompSize === 0xffffffff,
        compSize === 0xffffffff,
        localOffset === 0xffffffff,
      );
      if (uncompSize === 0xffffffff) uncompSize = zip64.uncomp;
      if (compSize === 0xffffffff) compSize = zip64.comp;
      if (localOffset === 0xffffffff) localOffset = zip64.offset;
    }

    const nameBytes = new Uint8Array(cdView.buffer, cdView.byteOffset + nameStart, nameLen);
    const name = utf8.decode(nameBytes);
    const entry: ZipDirEntry = {
      path: name,
      size: uncompSize,
      compressedSize: compSize,
      is_dir: name.endsWith('/'),
      is_symlink: ((extAttr >>> 16) & S_IFMT) === S_IFLNK,
      encrypted: (flags & 0x1) !== 0,
      method,
      localHeaderOffset: localOffset,
    };
    entries.push(entry);
    if (name === MANIFEST_NAME) manifestEntry = entry;
    p = nameStart + nameLen + extraLen + commentLen;
  }

  let manifest: unknown | null = null;
  if (manifestEntry !== null && manifestEntry.method === 0) {
    manifest = await readStoredManifest(blob, manifestEntry);
  }
  return { entries, manifest };
}

async function readStoredManifest(blob: Blob, entry: ZipDirEntry): Promise<unknown | null> {
  const header = await viewOf(blob.slice(entry.localHeaderOffset, entry.localHeaderOffset + 30));
  if (header.byteLength < 30 || header.getUint32(0, true) !== LOCAL_SIG) return null;
  const nameLen = header.getUint16(26, true);
  const extraLen = header.getUint16(28, true);
  const dataStart = entry.localHeaderOffset + 30 + nameLen + extraLen;
  const bytes = await blob.slice(dataStart, dataStart + entry.size).arrayBuffer();
  try {
    return JSON.parse(utf8.decode(bytes));
  } catch {
    return null;
  }
}
