#!/usr/bin/env python3
"""
75 HARD — a two-person wall tracker, one A3 landscape sheet.

75 days x 5 rules x 2 people. Both people's boxes sit on the same day row,
so a glance down the sheet shows who is behind and on what.

Layout (A3 landscape, 420 x 297 mm)
-----------------------------------
  header band   the 5 rules, the names, the start date, the chosen diets
  three blocks  days 1-25, 26-50, 51-75, side by side
  footer        the big rule, and a restart tally nobody wants to use

Six tick boxes per person per day: diet, workout 1, workout 2, water,
reading, progress picture. Rule 2 is two workouts, so it takes two boxes.

Run:  python3 build.py
"""

import base64
import pathlib

HERE = pathlib.Path(__file__).parent
FONTS = HERE / "fonts"

PEOPLE = [
    # water target is set to each person's height and need, not the flat gallon
    {"name": "Khethiwe", "water": "2.5L"},
    {"name": "Kabelo", "water": "3L"},
]

DAYS = 75
BLOCK = 25                      # days per column block
TASKS = [                       # (column head, what it means)
    ("DIET", "diet held"),
    ("W1", "45 min"),
    ("W2", "45 min"),
    ("{water}", "water"),       # filled in per person
    ("10pg", "read"),
    ("PIC", "progress"),
]


def cols_for(person):
    return "".join(f"<span>{h.format(water=person['water'])}</span>" for h, _ in TASKS)


# --------------------------------------------------------------------------
# Fonts — embedded so the printed sheet never depends on the network
# --------------------------------------------------------------------------

def _uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_css():
    mont = _uri(FONTS / "Montserrat-latin.woff2", "font/woff2")
    mont_ext = _uri(FONTS / "Montserrat-latin-ext.woff2", "font/woff2")
    mairo = _uri(FONTS / "Mairo.otf", "font/otf")
    return f"""
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont_ext}) format('woff2');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}}
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont}) format('woff2');}}
@font-face{{font-family:'Mairo';font-weight:400;src:url({mairo}) format('opentype');}}
"""


# --------------------------------------------------------------------------
# Styling — the same palette as the vision board, so they hang together
# --------------------------------------------------------------------------

CSS = """
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --linen:#E8E1D5;  --creme:#EEE4DA;  --sand:#E1D4C2;  --almond:#CEB59E;
  --taupe:#BEB5A9;  --stone:#A78D78;
  --terracotta:#A46447; --umber:#4C362D; --espresso:#291C0E; --cocoa:#6E473B;
  --sage:#88937B;
  --box:#F4EFE6;
}
body{font-family:'Montserrat',sans-serif;-webkit-font-smoothing:antialiased;
     text-rendering:geometricPrecision;}

.sheet{position:relative;width:420mm;height:297mm;background:var(--linen);
       color:var(--umber);padding:9mm;display:flex;flex-direction:column;
       overflow:hidden;}
.sheet::after{content:'';position:absolute;inset:0;pointer-events:none;opacity:.5;
  mix-blend-mode:multiply;
  background-image:radial-gradient(circle at 14% 18%,rgba(76,54,45,.05) 0 36%,transparent 37%),
                   radial-gradient(circle at 84% 74%,rgba(76,54,45,.04) 0 40%,transparent 41%);}

/* ---------------------------------------------------------- header ---- */
.head{background:var(--espresso);color:var(--linen);padding:6mm 7mm;
      display:flex;gap:7mm;align-items:stretch;}

.mark{flex:0 0 62mm;display:flex;flex-direction:column;justify-content:center;}
.mark .n{font-size:21mm;font-weight:900;letter-spacing:-.02em;line-height:.86;}
.mark .w{font-family:'Mairo',cursive;font-size:13mm;color:var(--terracotta);
         line-height:1.05;margin-top:1mm;}
.mark .t{font-size:2.2mm;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
         color:var(--almond);margin-top:3mm;}

.rules{flex:1;display:flex;gap:3mm;}
.rule{flex:1;border-left:.4mm solid rgba(232,225,213,.26);padding-left:3.4mm;}
.rule .k{font-size:2.1mm;font-weight:800;letter-spacing:.26em;color:var(--terracotta);}
.rule .h{font-size:3.1mm;font-weight:800;letter-spacing:.04em;line-height:1.25;
         margin:1.6mm 0 1.8mm;text-transform:uppercase;}
.rule .b{font-size:2.35mm;line-height:1.5;color:rgba(232,225,213,.78);}

.fields{flex:0 0 74mm;border-left:.4mm solid rgba(232,225,213,.26);padding-left:5mm;
        display:flex;flex-direction:column;justify-content:center;gap:3.1mm;}
.field{display:flex;align-items:baseline;gap:2.5mm;}
.field .lab{font-size:2.1mm;font-weight:800;letter-spacing:.22em;text-transform:uppercase;
            color:var(--almond);flex:0 0 11mm;}
.field .ln{flex:1;border-bottom:.3mm solid rgba(232,225,213,.42);height:4.2mm;}
.field .who{font-size:2.6mm;font-weight:900;letter-spacing:.08em;color:var(--terracotta);
            text-transform:uppercase;flex:0 0 18mm;}

/* ------------------------------------------------------------ grid ---- */
.blocks{flex:1;display:flex;gap:7mm;margin-top:5mm;}
.block{flex:1;display:flex;flex-direction:column;}

.bhead{display:flex;align-items:flex-end;gap:0;padding-bottom:1.6mm;
       border-bottom:.5mm solid var(--umber);}
.bhead .day{flex:0 0 11mm;font-size:2.1mm;font-weight:800;letter-spacing:.2em;
            color:var(--cocoa);text-transform:uppercase;}
.bhead .grp{display:flex;flex-direction:column;align-items:center;}
.bhead .grp .who{font-size:3.2mm;font-weight:900;color:var(--espresso);
                 line-height:1;margin-bottom:1.8mm;letter-spacing:.14em;
                 text-transform:uppercase;}
.bhead .grp .cols{display:flex;gap:1mm;}
.bhead .grp .cols span{width:8.4mm;text-align:center;font-size:1.95mm;font-weight:800;
                       letter-spacing:.04em;color:var(--cocoa);}
.bhead .gap{flex:0 0 5mm;align-self:stretch;position:relative;}
.bhead .gap::before{content:'';position:absolute;left:50%;top:0;bottom:-1.6mm;
  width:.35mm;background:var(--almond);}

.row{display:flex;align-items:center;height:7.32mm;
     border-bottom:.2mm solid rgba(167,141,120,.45);}
.row.five{border-bottom:.5mm solid var(--stone);}
.row.mile{border-bottom:.7mm solid var(--terracotta);}
.row .day{flex:0 0 11mm;font-size:2.9mm;font-weight:700;color:var(--umber);
          letter-spacing:.02em;}
.row.mile .day{color:var(--terracotta);font-weight:900;}
.row .gap{flex:0 0 5mm;align-self:stretch;position:relative;}
.row .gap::before{content:'';position:absolute;left:50%;top:0;bottom:0;
  width:.35mm;background:var(--almond);}
.row .grp{display:flex;gap:1mm;}

.box{width:8.4mm;height:5.2mm;border:.3mm solid var(--almond);background:var(--box);}
.row.mile .box{border-color:var(--terracotta);}

/* ---------------------------------------------------------- footer ---- */
.foot{margin-top:5mm;display:flex;align-items:center;gap:6mm;
      background:var(--espresso);color:var(--linen);padding:4mm 7mm;}
.foot .big{font-size:4.2mm;font-weight:900;letter-spacing:.1em;text-transform:uppercase;}
.foot .big em{font-style:normal;color:var(--terracotta);}
.foot .sub{font-size:2.4mm;color:rgba(232,225,213,.7);line-height:1.45;max-width:96mm;}
.foot .tally{margin-left:auto;display:flex;align-items:center;gap:3.5mm;}
.foot .tally .lab{font-size:2.1mm;font-weight:800;letter-spacing:.22em;
                  text-transform:uppercase;color:var(--almond);}
.foot .tally .row2{display:flex;align-items:center;gap:1.4mm;}
.foot .tally .t{font-size:2.2mm;font-weight:900;letter-spacing:.14em;text-transform:uppercase;
                color:var(--terracotta);margin-right:1.4mm;width:17mm;text-align:right;}
.foot .tally .tb{width:5.4mm;height:5.4mm;border:.3mm solid rgba(232,225,213,.5);}
"""


# --------------------------------------------------------------------------
# Content
# --------------------------------------------------------------------------

RULES = [
    ("01", "Follow a diet",
     "Chosen before Day 1. No cheat meals. Tailor it to your goal, then stick to it."),
    ("02", "Two 45-min workouts",
     "At least 3 hours apart. One of the two outdoors, whatever the weather."),
    ("03", "Drink your water",
     f"{PEOPLE[0]['name']} {PEOPLE[0]['water'].replace('L', ' L')} · "
     f"{PEOPLE[1]['name']} {PEOPLE[1]['water'].replace('L', ' L')}, set to height and "
     "need. Plain water — nothing else counts towards it."),
    ("04", "Read 10 pages",
     "Non-fiction or self-development. Audiobooks do not count."),
    ("05", "Progress picture",
     "One every single day. No exceptions, no skipped days."),
]


def header():
    rules = "".join(
        f'<div class="rule"><div class="k">{k}</div>'
        f'<div class="h">{h}</div><div class="b">{b}</div></div>'
        for k, h, b in RULES)
    return f"""
<div class="head">
  <div class="mark">
    <div class="n">75</div>
    <div class="w">hard</div>
    <div class="t">All five · every day · 75 days</div>
  </div>
  <div class="rules">{rules}</div>
  <div class="fields">
    <div class="field"><span class="who">{PEOPLE[0]["name"]}</span><span class="lab">Diet</span><span class="ln"></span></div>
    <div class="field"><span class="who">{PEOPLE[1]["name"]}</span><span class="lab">Diet</span><span class="ln"></span></div>
    <div class="field"><span class="who"></span><span class="lab">Day 1</span><span class="ln"></span></div>
    <div class="field"><span class="who"></span><span class="lab">Day 75</span><span class="ln"></span></div>
  </div>
</div>"""


def block(first):
    head = (f'<div class="bhead"><div class="day">Day</div>'
            f'<div class="grp"><div class="who">{PEOPLE[0]["name"]}</div>'
            f'<div class="cols">{cols_for(PEOPLE[0])}</div></div>'
            f'<div class="gap"></div>'
            f'<div class="grp"><div class="who">{PEOPLE[1]["name"]}</div>'
            f'<div class="cols">{cols_for(PEOPLE[1])}</div></div></div>')

    boxes = "".join('<div class="box"></div>' for _ in TASKS)
    rows = []
    for d in range(first, first + BLOCK):
        cls = "row"
        if d % 25 == 0:
            cls += " mile"
        elif d % 5 == 0:
            cls += " five"
        rows.append(
            f'<div class="{cls}"><div class="day">{d}</div>'
            f'<div class="grp a">{boxes}</div><div class="gap"></div>'
            f'<div class="grp b">{boxes}</div></div>')
    return f'<div class="block">{head}{"".join(rows)}</div>'


def footer():
    tally = "".join('<div class="tb"></div>' for _ in range(6))
    return """
<div class="foot">
  <div class="big">Miss anything &rarr; <em>back to Day 1</em></div>
  <div class="sub">Not a rest day, not a half day, not "I will double up tomorrow."
    The whole point of the challenge is that the rule does not bend — and a tick you
    did not earn makes the whole sheet worthless.</div>
  <div class="tally">
    <span class="lab">Restarts</span>
    <div class="row2"><span class="t">{a}</span>{tally}</div>
    <div class="row2"><span class="t">{b}</span>{tally}</div>
  </div>
</div>""".format(tally=tally, a=PEOPLE[0]["name"], b=PEOPLE[1]["name"])


PAGE = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>75 Hard — two-person tracker</title>
<style>{fonts}{css}{extra}</style></head><body>{body}</body></html>
"""

SCREEN_CSS = """
html,body{background:#3B3128;margin:0;padding:0;display:flex;
          align-items:flex-start;justify-content:center;}
.sheet{box-shadow:0 0 0 1mm rgba(0,0,0,.25);}
"""

PRINT_CSS = """
@page{size:A3 landscape;margin:0;}
html,body{background:#fff;margin:0;padding:0;}
@media screen{
  html,body{background:#3B3128;display:flex;justify-content:center;padding:10mm;}
  .sheet{box-shadow:0 2mm 6mm rgba(0,0,0,.4);}
}
"""


def main():
    body = ('<div class="sheet">' + header()
            + '<div class="blocks">'
            + "".join(block(f) for f in range(1, DAYS + 1, BLOCK))
            + '</div>' + footer() + '</div>')

    for name, extra in (("tracker.html", SCREEN_CSS), ("print.html", PRINT_CSS)):
        html = PAGE.format(fonts=font_css(), css=CSS, extra=extra, body=body)
        (HERE / name).write_text(html, encoding="utf-8")
        print(f"  {name}  ({len(html)/1024:.0f} kB)")


if __name__ == "__main__":
    print("building…")
    main()
    print("done.")
