# 2026 — INVASION — THE SECOND WAVE — LOVE

A printable vision board: **14 A4 sheets** that paste onto an **A0 landscape canvas
(1189 × 841 mm)**.

![The finished board](preview/board-A0.png)

---

## What's here

| File | What it is |
|---|---|
| `board.html` | The full A0 landscape preview — how the finished canvas will look |
| `print/01-headline-A4-landscape.pdf` | 4 pages, **A4 landscape** — the headline strip |
| `print/02-cards-A4-portrait.pdf` | 10 pages, **A4 portrait** — the vision cards |
| `print-banner.html` / `print-cards.html` | The same sheets as HTML, if you'd rather print from a browser |
| `preview/board-A0.png` | The preview image above |
| `preview/sheets/*.png` | Every sheet on its own, for checking one card up close |
| `build.py` | Regenerates everything after an edit |
| `fonts/` | The four embedded typefaces |

---

## Printing

Print **both PDFs at 100% / "Actual size"** — *not* "Fit to page", which silently
shrinks everything and breaks the tiling.

- `01-headline-A4-landscape.pdf` → A4, **landscape**, 4 pages
- `02-cards-A4-portrait.pdf` → A4, **portrait**, 10 pages

Turn **on** background graphics/colours. Six sheets are dark (the four headline
tiles and the two CRC sheets) — if your printer leaves a white border, trim it off;
if it can print borderless, use that. Matte 120–160 gsm paper holds the deep
espresso and navy without buckling; ordinary 80 gsm works but will cockle a little
under heavy ink.

**Cheaper option:** take the two PDFs to a print shop and ask for A4 on 160 gsm
matte. Fourteen sheets is a small job.

---

## The layout

```
┌──────────┬──────────┬──────────┬──────────┐
│   2026   │ INVASION │ THE SECOND│  Love   │   ← 4 × A4 landscape, edge to edge
│    B1    │    B2    │  WAVE B3 │   B4    │      (297 × 210 each = 1188 mm)
├────┬─────┴──┬───────┴─┬────────┴┬────────┤
│ C1 │  C2    │   C3    │   C4    │   C5   │   ← 10 × A4 portrait, 5 across × 2 down
│Cele│The     │   S2    │Dream of │Dream of│
│stia│Build   │Structure│  CRC i  │ CRC ii │
├────┼────────┼─────────┼─────────┼────────┤
│ C6 │  C7    │   C8    │   C9    │  C10   │
│Fin │Health  │ Social  │Relation │The     │
│ance│        │         │ships    │Rhythm  │
└────┴────────┴─────────┴─────────┴────────┘
```

Each sheet is a **whole, self-contained card** — no headline word and no sentence is
ever split across a seam. That means small misalignments when you paste simply do
not show.

### Pasting it up

1. Lay the canvas landscape. Mark a light pencil line **210 mm down from the top** —
   that's the bottom of the headline strip.
2. Paste the four headline tiles first, left to right, butted edge to edge along the
   top. They span the full width.
3. Leave roughly **14 mm** below the strip, then set out row 1 (C1–C5) with about
   **24 mm** margins left and right and **22 mm** between cards. Dry-lay the whole row
   before any glue touches paper.
4. Leave about **13 mm**, then row 2 (C6–C10) on the same column lines.
5. Spray mount or a glue stick around the edges and the centre. Work from the middle
   of each sheet outward to push air out.

The gaps are part of the design — the canvas colour showing between cards is what
makes it read as a gallery wall rather than a poster.

---

## The design

**Fonts** — three, all from the CRC brand set:

- **Parslay** — the strong cursive. Titles, pull-quotes, and "Love" on the headline.
- **Montserrat** — the modern sans. Everything structural.
- **Mairo** — CRC's brand hand, used for *S2 · Structure of Breakthrough* as asked.

**Colour** — taken from the reference swatches: Linen White `#E8E1D5`, Creme
`#EEE4DA`, Sand `#E1D4C2`, Toasted Almond `#CEB59E`, Stone `#A78D78`, Terracotta
`#A46447`, Deep Umber `#4C362D`, Espresso `#291C0E`, Muted Sage `#88937B`.

The two Dream of CRC sheets deliberately break the palette and use CRC's own —
navy `#080E36`, blue `#5CB2ED`, off-white `#F9F9F9` — with CRC's own typefaces, so
that section looks like it came straight off crcchurch.com.

---

## Why the board is built this way

The structure isn't decorative. Every card carries **scripture → vision →
actionables**, in that order, because that sequence is what the research on goal
achievement keeps pointing at:

- **Written goals plus action commitments plus weekly reporting.** Gail Matthews
  (Dominican University of California) found roughly **76%** of participants who
  wrote their goals, wrote action commitments and sent weekly progress to a friend
  achieved them, against **43%** who only thought about theirs. Hence: every card
  ends in actionables, and the Rhythm card sets a weekly send.
- **Rehearse the process, not the outcome.** Pham & Taylor (UCLA, 1999) found
  students who mentally rehearsed *studying* outperformed those who pictured the
  good grade — outcome-only fantasy actually reduced effort. Hence the actionables
  describe the work, not the trophy.
- **Contrast the wish with the obstacle.** Gabriele Oettingen's mental contrasting
  (WOOP) shows positive fantasy alone predicts *lower* achievement; pairing the wish
  with the obstacle and a plan is what moves it.
- **If–then beats intention.** Gollwitzer & Sheeran's meta-analysis across 94 studies
  found implementation intentions — naming *when and where* you will act — produce one
  of the larger effects in the literature. Hence the actionables are phrased
  "If it is Monday 06:00, then…".
- **Specific and hard beats "do your best."** Locke & Latham's goal-setting theory.
  Hence R30k, R50k, 4× a week, 100+ members, $100M — numbers, not adjectives.
- **Daily visual exposure.** A goal you see is a goal your attention keeps working on
  in the background. Hence: A0, on a wall, where you pass it.

The cadence is on sheet C10: **daily 60 seconds · weekly Sunday 18:00 review sent to
one person · monthly numbers · quarterly reset.** The board only works if that
happens; without it, this is expensive wallpaper.

---

## Editing

All content and styling lives in `build.py`. Change the copy, then:

```bash
python3 build.py
```

That rewrites `board.html`, `print-banner.html` and `print-cards.html`. To refresh
the preview PNG and the PDFs you need a Chromium via Playwright — see the render
notes at the bottom of `build.py`.

**Watch for overflow.** Cards are fixed at exactly A4 and clip anything that doesn't
fit. After editing, open `board.html` and check the card you touched, or run the
overflow audit in `render.mjs`.

---

## Notes on the content

- **Currency** is read as South African Rand (R30 000 savings, R50 000 investments);
  the per-month figures assume a twelve-month run. Adjust in `build.py` → `C6`.
- **The Dream of CRC** is reproduced from crcchurch.com. Three obvious typos on the
  live page are corrected here — "on oasis" → "an oasis", "oil around the world" →
  "all around the world", "short tem" → "short term". Everything else is verbatim.
- **Scripture** is KJV throughout (public domain).
- **The five names** box on C9 is intentionally blank. Write them in by hand.
