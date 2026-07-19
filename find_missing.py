import os, sys
src_dir = r'F:\gsuid_hub\node_modules\@thesvg\react\dist'
dist_dir = r'F:\gsuid_hub\dist\assets\js'

sources = set()
for f in os.listdir(src_dir):
    if f.endswith('.js') and not f.endswith('.cjs.js') and '.cjs' not in f and '.d.ts' not in f and '.js.map' not in f:
        sources.add(f[:-3])  # strip .js

# Get emitted chunks
chunks = set()
for f in os.listdir(dist_dir):
    # chunk format: <name>-<hash>.js
    if f.endswith('.js'):
        parts = f.rsplit('-', 1)
        if len(parts) == 2:
            chunks.add(parts[0])
        else:
            chunks.add(f[:-3])

missing = sources - chunks
print(f'sources: {len(sources)}, chunks: {len(chunks)}, missing: {len(missing)}')
print('missing slugs:')
for m in sorted(missing):
    print(f'  {m}')