#!/usr/bin/env python3
"""Localize external images referenced in Markdown to docs/public/images/external/.

Scans docs/posts/*.md and docs/pages/*.md, downloads every external image
(URLs with common image extensions), saves to docs/public/images/external/
with a short hash + filename, and rewrites the Markdown to reference the
local path. Safe to rerun — files already downloaded are skipped.
"""
from __future__ import annotations

import hashlib
import re
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
IMG_DIR = ROOT / "docs" / "public" / "images" / "external"
MD_DIRS = [ROOT / "docs" / "posts", ROOT / "docs" / "pages"]

IMG_EXT_RE = re.compile(r"\.(png|jpg|jpeg|gif|webp|svg)(\?|$)", re.I)
MD_IMG_RE = re.compile(r"(!\[[^\]]*\]\()(https?://[^)\s]+)(\))")


def sanitize(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]", "-", name)


def localize() -> None:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    url_map: dict[str, str] = {}

    for md_dir in MD_DIRS:
        for md_path in md_dir.glob("*.md"):
            text = md_path.read_text(encoding="utf-8")

            def replace(m: re.Match[str]) -> str:
                url = m.group(2)
                if not IMG_EXT_RE.search(url):
                    return m.group(0)
                if url not in url_map:
                    ext_match = IMG_EXT_RE.search(url)
                    assert ext_match
                    h = hashlib.sha1(url.encode()).hexdigest()[:10]
                    basename = sanitize(url.split("/")[-1].split("?")[0]) or (h + ext_match.group(0))
                    name = f"{h}-{basename}"
                    dest = IMG_DIR / name
                    if not dest.exists():
                        print(f"downloading {url} -> {dest.relative_to(ROOT)}")
                        try:
                            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                            with urllib.request.urlopen(req, timeout=20) as r:
                                dest.write_bytes(r.read())
                        except Exception as e:
                            print(f"  ERROR: {e}")
                            return m.group(0)
                    url_map[url] = f"/images/external/{name}"
                return f"{m.group(1)}{url_map[url]}{m.group(3)}"

            new_text = MD_IMG_RE.sub(replace, text)
            if new_text != text:
                md_path.write_text(new_text, encoding="utf-8")
                print(f"rewrote: {md_path.relative_to(ROOT)}")

    print(f"\nTotal URLs mapped: {len(url_map)}")


if __name__ == "__main__":
    localize()
