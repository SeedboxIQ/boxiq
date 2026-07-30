#!/usr/bin/env python3
"""
Build a printable demo sheet of QR codes for one client site.

    python3 tools/make-demo-labels.py aurora \\
        https://seedboxiq.github.io/boxiq/aurora/ SG01001091 SG01001093

Writes <folder>/demo-labels.html — print it, cut out the strips, and stick them
on a box (or just hold the sheet up) to demo scanning without hauling hardware
into the room. The QR codes are real: the box sticker code opens that client's
BoxIQ site, and each gate code opens it with the result already on screen.

Needs the qrcode package:  pip install qrcode
"""
import sys, re, html
from pathlib import Path

try:
    import qrcode
    import qrcode.image.svg
except ImportError:
    sys.exit("Install the qrcode package first:  pip install qrcode")


def qr_svg(data: str) -> str:
    """Return a compact inline SVG for one QR code."""
    img = qrcode.make(
        data,
        image_factory=qrcode.image.svg.SvgPathImage,
        box_size=10,
        border=2,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
    )
    svg = img.to_string(encoding="unicode")
    # SvgPathImage draws in module units (1 unit per QR module), not pixels,
    # so the viewBox must be sized in modules or the code renders unscannably small.
    size = img.width + 2 * img.border
    svg = re.sub(r'<svg[^>]*>', f'<svg xmlns="http://www.w3.org/2000/svg" '
                 f'viewBox="0 0 {size} {size}" width="100%" height="100%" '
                 f'shape-rendering="crispEdges">', svg, count=1)
    return svg.replace('fill="#000000"', 'fill="currentColor"')


def build(folder: str, base_url: str, gates: list[str]) -> Path:
    base = base_url.rstrip("/") + "/"
    cards = [(
        "Box sticker", "Opens BoxIQ", base,
        f'<div class="cap">Put this on the Gen2 box sticker</div>'
    )]
    for g in gates:
        cards.append((
            "Slidegate label", g, f"{base}?gate={g}",
            '<div class="cap">One scan opens BoxIQ with this gate already looked up</div>'
        ))

    blocks = "\n".join(f"""
    <figure class="card">
      <div class="kind">{html.escape(kind)}</div>
      <div class="qr">{qr_svg(url)}</div>
      <div class="plate"><span class="rivet"></span><span class="id">{html.escape(label)}</span><span class="rivet"></span></div>
      {cap}
      <div class="url">{html.escape(url)}</div>
    </figure>""" for kind, label, url, cap in cards)

    doc = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>BoxIQ demo labels — {html.escape(folder)}</title>
<style>
  @page {{ margin: 14mm; }}
  body{{font:15px/1.5 'Archivo',system-ui,sans-serif;color:#1F211E;margin:0;padding:26px;background:#E4E5E0}}
  h1{{font-size:19px;margin:0 0 4px}}
  p.sub{{margin:0 0 26px;color:#4A4E48;font-size:14px}}
  .sheet{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:20px;max-width:900px}}
  .card{{margin:0;background:#fff;border:1px solid #C9CBC5;border-radius:4px;padding:18px}}
  .kind{{font:500 10.5px/1 ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#6E7472;margin-bottom:12px}}
  .qr{{width:100%;aspect-ratio:1;color:#1F211E}}
  .plate{{display:flex;align-items:center;justify-content:space-between;gap:8px;background:#F2F2EE;border:1px solid #C9CBC5;border-radius:3px;padding:7px 9px;margin:12px 0 10px}}
  .rivet{{width:9px;height:9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 18%,#B9BCB6 55%,#7E837C 100%);flex:none}}
  .id{{font:600 15px/1 ui-monospace,monospace;letter-spacing:.1em}}
  .cap{{font-size:12.5px;color:#4A4E48;line-height:1.4}}
  .url{{margin-top:8px;font:10.5px/1.4 ui-monospace,monospace;color:#8A8F88;word-break:break-all}}
  @media print{{ body{{background:#fff;padding:0}} .card{{break-inside:avoid}} .url{{display:none}} }}
</style></head><body>
<h1>BoxIQ demo labels — {html.escape(folder)}</h1>
<p class="sub">Print at 100%. Scan with any phone camera — no app needed.</p>
<div class="sheet">{blocks}
</div></body></html>"""

    out = Path(folder) / "demo-labels.html"
    out.write_text(doc, encoding="utf-8")
    return out


if __name__ == "__main__":
    if len(sys.argv) < 4:
        sys.exit(__doc__)
    path = build(sys.argv[1], sys.argv[2], sys.argv[3:])
    print(f"wrote {path}")
