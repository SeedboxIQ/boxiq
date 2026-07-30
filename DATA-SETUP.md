# BoxIQ data layer

## Where it lives

Each client folder holds its own `gates.csv`, read by the shared engine in `assets/`. See
`README.md` for the folder layout. Nothing to build, no dependencies — the page reads the CSV on
load and keeps a copy in the browser, so a phone with no signal in the field still resolves gates
it has already seen.

## The gate list

One row per **load**, not per box. A slidegate gets refilled every season, so the same Gate ID
can appear more than once — BoxIQ shows the newest `loaded_on` as current and collapses the rest
under "earlier loads."

| Column | Required | Notes |
|---|---|---|
| `gate_id` | yes | As printed: `SG01001091`. Bare digits also work. |
| `brand` | yes | Seed brand / hybrid. Shown as the headline. |
| `batch_lot` | yes | Batch or lot number. Shown as the second field. |
| `loaded_on` | strongly recommended | `YYYY-MM-DD`. This is what orders the history. |
| `seed_size` | optional | |
| `treatment` | optional | |
| `box_id` | optional | Your own box/unit number. |
| `filled_by` | optional | |
| `notes` | optional | Renders full width at the bottom. |

Extra columns are ignored, so you can keep internal fields in the same sheet. Column order
doesn't matter; headers are matched by name (case and spacing are forgiving).

## Two ways to host it

**A. CSV in the repo** — current setup. Edit the client's `gates.csv`, commit, live in about a minute.
Good if one or two people maintain it and you want the history in Git.

**B. Google Sheet** — better if plant staff record loads as they fill boxes.
1. Build a sheet with the header row above.
2. File → Share → **Publish to web** → choose the sheet → **Comma-separated values (.csv)** → Publish.
3. Copy that link (it ends in `output=csv`) into `"dataUrl"` in that client's `index.html` config block.

Two things to know about B: the published CSV is public to anyone with the link, so keep
customer names and pricing out of that sheet; and Google caches it, so edits take up to about
five minutes to appear.

A JSON file or endpoint works too — if the response starts with `[` or `{`, BoxIQ parses it as
JSON with the same field names.

## What the QR codes should encode

- **Slidegate label QR** — make it `https://seedboxiq.github.io/boxiq/<client>/?gate=SG01001091`,
  so the customer lands on their own co-branded page.
  Then one scan from the camera app opens BoxIQ *and* shows the result, no typing, no second
  scan. If the existing labels encode the bare `SG01001091` instead, the in-page scanner still
  reads them; you just need the box sticker scanned first.
- **Box sticker QR** — plain `https://seedboxiq.github.io/boxiq/<client>/`.
- Both are pre-generated in each client's `demo-labels.html`.

Typed and scanned input is normalised before lookup: case and punctuation are stripped, a
missing `SG` is added, short digit strings are zero-padded to eight, and the glare-prone
characters on a printed label (`O`→`0`, `I`/`L`→`1`, `S`→`5`, `B`→`8`) are corrected. Codes that
aren't Gate IDs are rejected rather than looked up.

## Test checklist

- [ ] `SG01001091` typed, scanned, and passed as `?gate=SG01001091`
- [ ] `1001091` (digits only, no padding) resolves to the same gate
- [ ] A Gate ID that isn't in the list shows the "no load recorded" tag, not a blank result
- [ ] Camera denied → the page tells you to type it instead
- [ ] Airplane mode after one successful load → cached list still answers
- [ ] Real slidegate label in daylight and under a truck canopy
- [ ] Add a row to the sheet, reload, confirm it appears

## Still open

- Who writes the load record, and when? The tool is only as good as the row created when the
  box gets filled — a phone-friendly entry form writing to the same sheet is the natural next piece.
- Anything worth showing beyond brand and lot? Germination %, treatment expiry, and the
  seed-tag PDF are the usual asks once growers start scanning.
