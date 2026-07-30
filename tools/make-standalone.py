#!/usr/bin/env python3
"""
Flatten one client site into a single file that needs no server and no signal.

    python3 tools/make-standalone.py aurora

Writes <folder>/standalone-<folder>.html — the engine, the styles, and the gate
rows all inlined. Email it, put it on a USB stick, open it at a trade show with
no wifi. Web fonts are the only thing it still reaches for; without a connection
it falls back to system fonts and everything else works.
"""
import json, re, sys
from pathlib import Path

def build(slug: str) -> Path:
    folder = Path(slug)
    page = (folder / "index.html").read_text(encoding="utf-8")

    css_ref = re.search(r'<link rel="stylesheet" href="([^"]+boxiq-v\d+\.css)">', page)
    js_ref  = re.search(r'<script src="([^"]+boxiq-v\d+\.js)"></script>', page)
    if not css_ref or not js_ref:
        sys.exit(f"{slug}/index.html doesn't look like a BoxIQ client stub")

    css = (folder / css_ref.group(1)).resolve().read_text(encoding="utf-8")
    js  = (folder / js_ref.group(1)).resolve().read_text(encoding="utf-8")

    cfg = json.loads(re.search(
        r'<script type="application/json" id="boxiq-config">(.*?)</script>', page, re.S).group(1))
    data_ref = cfg.get("dataUrl", "gates.csv")
    if data_ref.startswith("http"):
        sys.exit("this client reads a remote sheet; point dataUrl at a local CSV to flatten it")
    cfg["inlineData"] = (folder / data_ref).read_text(encoding="utf-8")
    cfg.pop("dataUrl", None)

    # carry the logo inside the file too, so the single file really is single
    logo = cfg.get("logo", "")
    if logo and (folder / logo).exists():
        import base64, mimetypes
        mime = mimetypes.guess_type(logo)[0] or "image/png"
        blob = base64.b64encode((folder / logo).read_bytes()).decode("ascii")
        cfg["logo"] = f"data:{mime};base64,{blob}"

    block = ('<script type="application/json" id="boxiq-config">\n'
             + json.dumps(cfg, indent=2) + '\n</script>')
    # Rewrite the config first, and only once: inlined code can legitimately
    # contain the words "boxiq-config", and a second match would eat the engine.
    # The lambda matters too — the JSON holds backslashes re.sub would unescape.
    out_html = re.sub(r'<script type="application/json" id="boxiq-config">.*?</script>',
                      lambda _m: block, page, count=1, flags=re.S)
    out_html = out_html.replace(css_ref.group(0), f"<style>\n{css}\n</style>")
    out_html = out_html.replace(js_ref.group(0), f"<script>\n{js}\n</script>")

    out = folder / f"standalone-{slug}.html"
    out.write_text(out_html, encoding="utf-8")
    return out

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"wrote {build(sys.argv[1])}")
