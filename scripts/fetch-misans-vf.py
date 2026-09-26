#!/usr/bin/env python3
"""Download dsrkafuu/misans Normal VF WOFF2 slices into public/misans-vf/."""
from __future__ import annotations

import concurrent.futures
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "misans-vf"
CSS_URL = "https://raw.githubusercontent.com/dsrkafuu/misans/main/lib/Normal/MiSansVF.min.css"
BASE = "https://raw.githubusercontent.com/dsrkafuu/misans/main/lib/Normal/"


def fetch(name: str) -> tuple[str, int, str]:
    out = DEST / name
    if out.exists() and out.stat().st_size > 1000:
        return name, out.stat().st_size, "skip"
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            urllib.request.urlretrieve(BASE + name, out)
            return name, out.stat().st_size, "ok"
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if out.exists():
                out.unlink()
    raise RuntimeError(f"failed {name}: {last_error}") from last_error


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    css_path = DEST / "MiSansVF.min.css"
    urllib.request.urlretrieve(CSS_URL, css_path)
    css = css_path.read_text(encoding="utf-8")
    names = sorted(set(re.findall(r"url\('([^']+)'\)", css)))
    print(f"slices {len(names)}")
    done = 0
    with concurrent.futures.ThreadPoolExecutor(4) as pool:
        for name, size, status in pool.map(fetch, names):
            done += 1
            print(f"{done}/{len(names)} {status} {name} {size}")
    total = sum(p.stat().st_size for p in DEST.glob("*.woff2"))
    print(f"total_woff2_mb {total / 1024 / 1024:.2f} files {len(list(DEST.glob('*.woff2')))}")


if __name__ == "__main__":
    main()
