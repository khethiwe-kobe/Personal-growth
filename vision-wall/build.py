#!/usr/bin/env python3
"""
2026 VISION WALL — pictures only, one A3 portrait sheet.

A companion to the vision board in ../vision-board: same paper, same palette,
no words. Five images in a two-column masonry, each sized so the crop stays
close to the picture's own proportions.

Layout (A3 portrait, 297 x 420 mm)
----------------------------------
  margin 13 mm, gutter 9 mm, two columns of 131 mm

  left   car     131 x 193      right  travel  131 x 164
         gym     131 x 192             smile   131 x 114
                                       room    131 x  98

Both columns come to 394 mm, so the block sits flush top and bottom.

Every picture gets the same warm grade, which is what makes five photographs
from five different sources read as one wall rather than a pinboard.

Run:  python3 build.py
"""

import base64
import pathlib

HERE = pathlib.Path(__file__).parent
IMAGES = HERE / "images"

# A small title band, off by default — the brief was pictures only.
HEADER = False

# How hard the unifying grade is pushed. 0 leaves the photographs alone.
WARMTH = 1.0

MIME = {".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".webp": "image/webp"}

# file, printed width, printed height (mm), and where to anchor the crop.
# The anchor matters wherever the frame is a different shape to the picture:
# gym.jpg is a phone screenshot with a "1/10" badge and a mute icon down its
# right edge, so its crop is pulled left to lose them.
LEFT = [("car.jpg",        131,  193, "center"),
        ("gym.jpg",        131,  192, "22% center")]

RIGHT = [("travel.webp",   131,  164, "center"),
         ("smile.jpg",     131,  114, "center 58%"),
         ("room.webp",     131,   98, "center")]


def data_uri(name):
    f = IMAGES / name
    return f"data:{MIME[f.suffix.lower()]};base64," + \
        base64.b64encode(f.read_bytes()).decode()


CSS = """
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --linen:#E8E1D5;  --creme:#EEE4DA;  --sand:#E1D4C2;  --almond:#CEB59E;
  --stone:#A78D78;  --terracotta:#A46447; --umber:#4C362D; --espresso:#291C0E;
}
body{font-family:'Montserrat',sans-serif;-webkit-font-smoothing:antialiased;}

.sheet{position:relative;width:297mm;height:420mm;background:var(--linen);
       padding:13mm;display:flex;flex-direction:column;overflow:hidden;}

/* the same tooth as the other sheets, so flat linen does not print dead */
.sheet::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
  mix-blend-mode:multiply;z-index:3;
  background-image:radial-gradient(circle at 16% 20%,rgba(76,54,45,.05) 0 36%,transparent 37%),
                   radial-gradient(circle at 82% 76%,rgba(76,54,45,.04) 0 40%,transparent 41%);}

.cols{display:flex;gap:9mm;flex:1;}
.col{display:flex;flex-direction:column;gap:9mm;}

.ph{position:relative;overflow:hidden;background:var(--sand);
    border:.35mm solid rgba(76,54,45,.30);}
.ph img{width:100%;height:100%;object-fit:cover;display:block;
        filter:sepia(calc(.16 * var(--w))) saturate(calc(1 - .10 * var(--w)))
               contrast(calc(1 + .03 * var(--w))) brightness(calc(1 + .01 * var(--w)));}
/* one warm wash over every picture — this is what makes five sources read as one wall */
.ph::after{content:'';position:absolute;inset:0;pointer-events:none;
           background:rgba(164,100,71,calc(.08 * var(--w)));mix-blend-mode:multiply;}
.ph::before{content:'';position:absolute;inset:0;pointer-events:none;z-index:2;
            box-shadow:inset 0 0 0 .8mm rgba(232,225,213,.42);}

/* the one theme signature on a wordless sheet */
.tick{position:absolute;background:var(--terracotta);z-index:4;}
.tick.a{left:13mm;top:6.4mm;width:18mm;height:.8mm;}
.tick.b{right:13mm;bottom:6.4mm;width:18mm;height:.8mm;}

.head{text-align:center;padding-bottom:7mm;}
.head .y{font-size:9mm;font-weight:900;letter-spacing:.3em;color:var(--espresso);}
.head .s{font-size:2.6mm;font-weight:700;letter-spacing:.42em;text-transform:uppercase;
         color:var(--terracotta);margin-top:2.4mm;}
"""

FONT_CSS_PLACEHOLDER = ""


def font_css():
    """Only needed when the optional header band is switched on."""
    if not HEADER:
        return ""
    fonts = HERE.parent / "vision-board" / "fonts"
    out = []
    for fam, fn, fmt in (("Montserrat", "Montserrat-latin.woff2", "woff2"),
                         ("Mairo", "Mairo.otf", "opentype")):
        f = fonts / fn
        if not f.exists():
            continue
        mime = "font/woff2" if fmt == "woff2" else "font/otf"
        uri = f"data:{mime};base64," + base64.b64encode(f.read_bytes()).decode()
        weight = "100 900" if fam == "Montserrat" else "400"
        out.append(f"@font-face{{font-family:'{fam}';font-weight:{weight};"
                   f"src:url({uri}) format('{fmt}');}}")
    return "\n".join(out)


def column(items):
    cells = []
    for name, w, h, pos in items:
        cells.append(
            f'<div class="ph" style="width:{w}mm;height:{h}mm">'
            f'<img src="{data_uri(name)}" style="object-position:{pos}" alt=""></div>')
    return f'<div class="col">{"".join(cells)}</div>'


def header():
    if not HEADER:
        return ""
    return ('<div class="head"><div class="y">2026</div>'
            '<div class="s">Invasion · The Second Wave · Love</div></div>')


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>2026 Vision Wall</title>
<style>{fonts}{css}{extra}</style></head><body>{body}</body></html>
"""

SCREEN_CSS = """
html,body{background:#3B3128;margin:0;padding:0;display:flex;
          align-items:flex-start;justify-content:center;}
.sheet{box-shadow:0 0 0 1mm rgba(0,0,0,.25);}
"""

PRINT_CSS = """
@page{size:A3 portrait;margin:0;}
html,body{background:#fff;margin:0;padding:0;}
@media screen{
  html,body{background:#3B3128;display:flex;justify-content:center;padding:10mm;}
  .sheet{box-shadow:0 2mm 6mm rgba(0,0,0,.4);}
}
"""


def main():
    body = (f'<div class="sheet" style="--w:{WARMTH}">'
            f'<div class="tick a"></div><div class="tick b"></div>'
            f'{header()}'
            f'<div class="cols">{column(LEFT)}{column(RIGHT)}</div>'
            f'</div>')

    for name, extra in (("wall.html", SCREEN_CSS), ("print.html", PRINT_CSS)):
        html = PAGE.format(fonts=font_css(), css=CSS, extra=extra, body=body)
        (HERE / name).write_text(html, encoding="utf-8")
        print(f"  {name}  ({len(html)/1024:.0f} kB)")


if __name__ == "__main__":
    print("building…")
    main()
    print("done.")
