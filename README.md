# BoxIQ — one engine, one folder per prospect

```
boxiq/
  assets/
    boxiq-v1.css        shared look — every site loads this
    boxiq-v1.js         shared behaviour — lookup, QR scanning, data loading
  index.html            plain Seedbox-branded version (no partner)
  gates.csv
  aurora/               ← Aurora Cooperative demo, self-contained
    index.html          colours + wording + which CSV to read (about 40 lines)
    gates.csv           Aurora's demo rows
    demo-labels.html    printable QR codes for this site
  becks/                ← same pattern, proves nothing collides
  _template/            copy this folder to start a new prospect
  tools/
    new-client.sh       does the copying and renaming for you
    make-demo-labels.py regenerates the printable QR sheet
    make-standalone.py  flattens a client site into one emailable file
```

Each prospect is a folder, and a folder is a URL:

| Prospect | URL to send |
|---|---|
| Aurora Cooperative | `https://seedboxiq.github.io/boxiq/aurora/` |
| Beck's | `https://seedboxiq.github.io/boxiq/becks/` |
| Anyone, later | `https://seedboxiq.github.io/boxiq/<folder>/` |

## Adding a prospect

With a terminal:

```bash
tools/new-client.sh bayer "Bayer" "#00617F" "#004C63" light
```

Or by hand, entirely in the GitHub web UI: copy `_template/`, rename it, and edit the two
things at the top of its `index.html` — the three hex values in the `:root` block, and the
`CLIENT_NAME` strings in the config block. Then replace `gates.csv`. That's the whole job.

## Why Aurora can't get lost

- **Nothing is shared but the engine.** Aurora's colours, wording, logo, and data all live
  inside `aurora/`. Creating `bayer/` writes only inside `bayer/`.
- **`new-client.sh` refuses to write into a folder that already exists.** Wrong slug, no damage.
- **The engine is version-pinned.** Aurora's page asks for `boxiq-v1.js`. When you want to
  change how BoxIQ behaves after a demo is already out in the world, copy the file to
  `boxiq-v2.js` and point only new sites at it. A demo you sent in July still works in March.
- **Git is the backstop.** Every demo is a commit, so even a deleted folder comes back. Worth
  tagging the repo the day of a pitch: `git tag aurora-pitch-2026-07 && git push --tags`.

The one rule: **don't edit `assets/` to change how one client looks.** If a client needs
something the config can't express, add a config option to the engine so every site keeps
working, then set it in that client's folder.

## Co-branding a specific prospect

Four things carry the co-brand:

1. **Accent colour** — the three hex values in `:root`. `--accent` is theirs; `--accent-deep` is
   a darker shade for small text; `--on-accent` is the text colour on top of the accent
   (`#F2F2EE` on a dark accent, `#1F211E` on a light one). Get these off their website or a
   brand kit rather than eyeballing a screenshot.
2. **Logo** — save their file in their folder and name it in `"logo"`. It sits beside the
   seedbox mark with a hairline between them, which is the honest way to render a partnership.
   If the file is missing the page falls back to their name in text, so a broken image never
   shows up mid-presentation.
3. **Wording** — `preparedFor`, `lede`, `steps`, `supportNote`, `footerNote`. Aurora's version
   mentions Aurora locations and agronomists; a manufacturer's version wouldn't.
4. **Data** — `gates.csv` with rows that look like their operation. For a co-op, that means
   several brands, delivery locations, and grower names. For a seed brand, their own hybrids.
   This is what makes the demo land, and it's the cheapest thing on this list to get right.

Keep `"demoData": true` while the rows are invented — it puts a small **Demo data** flag in the
header so nobody in the room mistakes samples for their records. Turn it off when a real pilot
list is behind it. And use their actual logo from their site or brand kit rather than a
recreation; a co-branded evaluation demo is normal practice, but it's their mark, so keep the
"prepared for evaluation" framing on it and pull it down when a deal goes cold.

## Presenting without hauling a box into the room

`demo-labels.html` in each client folder prints QR codes that are live for that site:

- **Box sticker** code → opens their BoxIQ.
- **Slidegate** codes → open their BoxIQ *with the gate already looked up*, which is the moment
  worth demonstrating: one scan, brand and lot on screen, no typing.

Print it, or put it on a slide and let people scan the projector. Regenerate for any client:

```bash
python3 tools/make-demo-labels.py becks https://seedboxiq.github.io/boxiq/becks/ SG01002001
```

For real deployments, print the slidegate labels with
`https://seedboxiq.github.io/boxiq/<client>/?gate=SG01001091` encoded, so a customer's phone
lands on their own co-branded page.

## One file you can email

```bash
python3 tools/make-standalone.py aurora
```

Writes `aurora/standalone-aurora.html`: the engine, the styles, their logo, and the gate rows
all folded into one file. No server, no signal, nothing to install — open it from a desktop, a
USB stick, or an email attachment at a trade show booth with dead wifi. Web fonts are the only
thing it still reaches for, and it falls back to system fonts without them.

Use the hosted URL when you want them scanning a QR code, and the single file when you want to
hand the demo to someone to keep. Regenerate it after changing that client's data or colours.

## Data schema

See `DATA-SETUP.md` — columns, one row per *load* rather than per box, and how to point a client
folder at a published Google Sheet instead of a CSV in the repo.
