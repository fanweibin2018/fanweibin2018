#!/usr/bin/env python3
"""Migrate Halo backup -> VitePress Markdown with patch-application."""
import json, base64, re
from pathlib import Path
from markdownify import markdownify as html_to_md

BACKUP = Path("/sessions/gallant-determined-darwin/mnt/fanweibin.cn/20260416110352-backup-v7e7bl9t/extensions.data")
ROOT = Path("/sessions/gallant-determined-darwin/mnt/fanweibin.cn/docs")
POSTS_DIR = ROOT / "posts"
PAGES_DIR = ROOT / "pages"

SAFE = re.compile(r"[^\w\-\u4e00-\u9fff]+")


def safe_name(s, fb):
    s = (s or "").strip()
    s = SAFE.sub("-", s).strip("-")
    return s or fb


def yq(v):
    return "'" + (v or "").replace("'", "''") + "'"


def apply_patch(base_html: str, patch_json: str) -> str:
    """Apply a Halo rawPatch JSON to a base HTML body.

    Patch entries have {type: CHANGE|INSERT|DELETE, source: {position, lines}, target: {position, lines}}.
    Positions are line indices in the source (base). We apply patches from the
    highest source.position downward so shifts don't invalidate earlier positions.
    """
    try:
        patches = json.loads(patch_json)
    except Exception:
        return base_html
    lines = base_html.split("\n")
    # Sort descending by source.position, and within same position: CHANGE/DELETE before INSERT
    def sort_key(e):
        pos = e.get("source", {}).get("position", 0)
        t = e.get("type", "")
        # when two patches share the same position, process DELETE/CHANGE first, then INSERT
        order = 0 if t in ("CHANGE", "DELETE") else 1
        return (-pos, order)
    patches.sort(key=sort_key)
    for e in patches:
        t = e.get("type")
        sp = e.get("source", {})
        tg = e.get("target", {})
        s_pos = sp.get("position", 0)
        s_lines = sp.get("lines", [])
        t_lines = tg.get("lines", [])
        if t == "CHANGE":
            lines[s_pos:s_pos + len(s_lines)] = t_lines
        elif t == "DELETE":
            del lines[s_pos:s_pos + len(s_lines)]
        elif t == "INSERT":
            lines[s_pos:s_pos] = t_lines
    return "\n".join(lines)


def load():
    arr = json.load(BACKUP.open())
    posts, pages, snaps, cats, tags = [], [], {}, {}, {}
    for it in arr:
        if not it["name"].startswith("/registry/content.halo.run"):
            continue
        d = json.loads(base64.b64decode(it["data"]))
        k = d.get("kind")
        if k == "Post": posts.append(d)
        elif k == "SinglePage": pages.append(d)
        elif k == "Snapshot": snaps[d["metadata"]["name"]] = d
        elif k == "Category": cats[d["metadata"]["name"]] = d["spec"].get("displayName", "")
        elif k == "Tag": tags[d["metadata"]["name"]] = d["spec"].get("displayName", "")
    return posts, pages, snaps, cats, tags


def resolve_html(post, snaps):
    sp = post["spec"]
    rel, base = sp.get("releaseSnapshot"), sp.get("baseSnapshot")
    base_snap = snaps.get(base)
    rel_snap = snaps.get(rel)
    if not base_snap:
        return ""
    base_html = base_snap["spec"].get("rawPatch", "")
    if rel == base or not rel_snap:
        return base_html
    rel_raw = rel_snap["spec"].get("rawPatch", "")
    if rel_raw.lstrip().startswith("[{"):
        return apply_patch(base_html, rel_raw)
    # release snap itself contains full HTML
    return rel_raw


def to_md(html: str) -> str:
    md = html_to_md(html or "", heading_style="ATX", bullets="-", code_language="")
    md = re.sub(r"\n{3,}", "\n\n", md).strip()
    return md + "\n"


def build(post, snaps, cats, tags):
    sp, meta = post["spec"], post["metadata"]
    title = sp.get("title") or meta.get("name", "untitled")
    slug = sp.get("slug") or meta.get("name")
    pt = sp.get("publishTime") or meta.get("creationTimestamp") or ""
    date = pt[:10]
    html = resolve_html(post, snaps)
    body = to_md(html)
    cat_names = [cats.get(c, c) for c in sp.get("categories", [])]
    tag_names = [tags.get(t, t) for t in sp.get("tags", [])]
    fm = ["---", f"title: {yq(title)}"]
    if date: fm.append(f"date: {date}")
    if slug: fm.append(f"slug: {yq(slug)}")
    if cat_names:
        fm.append("categories:")
        for c in cat_names:
            fm.append(f"  - {yq(c)}")
    if tag_names:
        fm.append("tags:")
        for t in tag_names:
            fm.append(f"  - {yq(t)}")
    fm.append("source: halo")
    fm.append("---\n")
    fn = f"{date + '-' if date else ''}{safe_name(slug, meta['name'])}.md"
    return fn, "\n".join(fm) + "\n# " + title + "\n\n" + body


def main():
    posts, pages, snaps, cats, tags = load()
    POSTS_DIR.mkdir(parents=True, exist_ok=True)
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    pub = [p for p in posts if p["spec"].get("publish") and not p["spec"].get("deleted")]
    for p in pub:
        fn, c = build(p, snaps, cats, tags)
        (POSTS_DIR / fn).write_text(c, encoding="utf-8")
    pub_pages = [p for p in pages if p["spec"].get("publish") and not p["spec"].get("deleted")]
    for p in pub_pages:
        fn, c = build(p, snaps, cats, tags)
        (PAGES_DIR / fn).write_text(c, encoding="utf-8")
    print(f"Posts published: {len(pub)} / {len(posts)}")
    print(f"Pages published: {len(pub_pages)} / {len(pages)}")
    # summary of files
    files = sorted(POSTS_DIR.iterdir())
    print(f"Output files in docs/posts/: {len(files)}")
    for f in files[:8]:
        print(" ", f.name)
    print("...")


main()
