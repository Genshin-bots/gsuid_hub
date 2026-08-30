import { promisify } from 'node:util';
import { gzip, brotliCompress, constants as zlibConstants } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';

const gzipAsync = promisify(gzip);
const brotliAsync = promisify(brotliCompress);

/** Skip files smaller than a TCP MSS; compressing them can enlarge the payload. */
export const MIN_COMPRESS_BYTES = 1024;

export const COMPRESSIBLE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.htm',
  '.json',
  '.svg',
  '.txt',
  '.xml',
  '.wasm',
  '.map',
  '.webmanifest',
]);

export function isCompressibleAsset(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return COMPRESSIBLE_EXTENSIONS.has(ext);
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = path.join(dir, String(ent.name));
    if (ent.isDirectory()) {
      out.push(...(await walkFiles(full)));
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

export async function precompressDist(distDir: string): Promise<{ files: number }> {
  const all = await walkFiles(distDir);
  let files = 0;
  await Promise.all(
    all.map(async (file) => {
      if (!isCompressibleAsset(file)) {
        return;
      }
      const data = await fs.readFile(file);
      if (data.length < MIN_COMPRESS_BYTES) {
        return;
      }
      const gz = await gzipAsync(data, { level: 9 });
      if (gz.length < data.length) {
        await fs.writeFile(`${file}.gz`, gz);
      }
      const br = await brotliAsync(data, {
        params: {
          [zlibConstants.BROTLI_PARAM_QUALITY]: 11,
          [zlibConstants.BROTLI_PARAM_SIZE_HINT]: data.length,
        },
      });
      if (br.length < data.length) {
        await fs.writeFile(`${file}.br`, br);
      }
      files += 1;
    }),
  );
  return { files };
}
