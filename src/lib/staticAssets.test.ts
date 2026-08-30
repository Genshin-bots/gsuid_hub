import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { afterEach, describe, expect, it } from 'vitest';
import { isCompressibleAsset, MIN_COMPRESS_BYTES, precompressDist } from './staticAssets';

describe('isCompressibleAsset', () => {
  it('accepts text assets and rejects already-compressed binaries', () => {
    expect(isCompressibleAsset('assets/js/index-abc.js')).toBe(true);
    expect(isCompressibleAsset('index.html')).toBe(true);
    expect(isCompressibleAsset('version.json')).toBe(true);
    expect(isCompressibleAsset('icon.svg')).toBe(true);
    expect(isCompressibleAsset('assets/index.css')).toBe(true);
    expect(isCompressibleAsset('ICON.png')).toBe(false);
    expect(isCompressibleAsset('font.woff2')).toBe(false);
    expect(isCompressibleAsset('index.js.gz')).toBe(false);
    expect(isCompressibleAsset('index.js.br')).toBe(false);
  });
});

describe('precompressDist', () => {
  const dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it('writes smaller gzip and brotli companions for compressible files', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'gshub-precompress-'));
    dirs.push(dir);
    const jsPath = path.join(dir, 'index-test.js');
    const payload = 'console.log("compress me");\n'.repeat(80);
    expect(Buffer.byteLength(payload)).toBeGreaterThan(MIN_COMPRESS_BYTES);
    await writeFile(jsPath, payload);
    await writeFile(path.join(dir, 'tiny.js'), 'ok');
    await writeFile(path.join(dir, 'ICON.png'), Buffer.alloc(2048, 1));

    const { files } = await precompressDist(dir);
    expect(files).toBe(1);

    const gz = await readFile(`${jsPath}.gz`);
    const br = await readFile(`${jsPath}.br`);
    expect(gz.length).toBeLessThan(Buffer.byteLength(payload));
    expect(br.length).toBeLessThan(Buffer.byteLength(payload));
    expect(gunzipSync(gz).toString('utf8')).toBe(payload);
    expect(brotliDecompressSync(br).toString('utf8')).toBe(payload);
  });
});
