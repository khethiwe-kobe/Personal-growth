#!/usr/bin/env python3
"""
PRAYER CARDS — cut-out cards, 8 to an A4 sheet.

Each card carries one specific thing, in four parts:

    REQUEST     what is being asked for, in one line
    SCRIPTURE   the verse that holds the faith up while you wait
    RECEIVED    prayed in the past tense, with a date and time to write in
    PRAISE      thanks given for it as though it is already done

The pattern is Mark 11:24 — "you can pray for anything, and if you believe
that you've received it, it will be yours" — which is why the third block is
written as a thing already had, not a thing still wanted.

Layout
------
A4 portrait, 8 mm margin, 2 columns x 4 rows, 4 mm gutters.
Cards come out at 95 x 67.25 mm with a hairline border to cut along. The
gutters mean this prints on any printer — no borderless, no bleed.

Run:  python3 build.py
"""

import base64
import pathlib

HERE = pathlib.Path(__file__).parent
FONTS = HERE.parent / "vision-board" / "fonts"

DEADLINE = "BY 30 OCTOBER"
PER_PAGE = 8


def _uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_css():
    mont = _uri(FONTS / "Montserrat-latin.woff2", "font/woff2")
    mairo = _uri(FONTS / "Mairo.otf", "font/otf")
    return f"""
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont}) format('woff2');}}
@font-face{{font-family:'Mairo';font-weight:400;src:url({mairo}) format('opentype');}}
"""


# --------------------------------------------------------------------------
# The cards. Keep every line short — these are 95 mm wide.
# --------------------------------------------------------------------------

CARDS = [
    dict(
        title="The $5,000 Bonus",
        request="That the value-based bonus is put in writing — thresholds and "
                "percentage named — and that I earn it.",
        verse="“But as for you, be strong and courageous, for your work will be rewarded.”",
        ref="2 Chronicles 15:7 NLT",
        received="Father, I thank you that the $5,000 is already mine — written down, "
                 "earned and paid.",
        praise="Thank you Jesus that I am paid for the value I create.",
    ),
    dict(
        title="Innaderm · $10K Days",
        request="That Innaderm scales from $3K days to $10K days, and that I am the one "
                "who helps carry it there.",
        verse="“Work brings profit, but mere talk leads to poverty!”",
        ref="Proverbs 14:23 NLT",
        received="Father, I thank you that Innaderm is already at $10K days.",
        praise="Thank you Jesus for profit that is real and not theory.",
    ),
    dict(
        title="Disputes Under 1%",
        request="That Innaderm’s dispute rate falls from 0.9% and no hold is ever placed "
                "on the account.",
        verse="“The LORD keeps you from all harm and watches over your life.”",
        ref="Psalm 121:7 NLT",
        received="Father, I thank you that the account is already safe and the rate is "
                 "already falling.",
        praise="Thank you Jesus that what I build protects this house.",
    ),
    dict(
        title="The Systems",
        request="That the dashboards, the ClickUp → AdNova automation and the pre-order "
                "flow all go live and work.",
        verse="“Commit your actions to the LORD, and your plans will succeed.”",
        ref="Proverbs 16:3 NLT",
        received="Father, I thank you that the systems are already built and already "
                 "saving hours and money.",
        praise="Thank you Jesus for wisdom to build what outlives my hands.",
    ),
    dict(
        title="Finances",
        request="R32 000 bonus in October. R20 000 into savings and investments. "
                "R15 000 to R&amp;D and living.",
        verse="“And this same God who takes care of me will supply all your needs from "
              "his glorious riches.”",
        ref="Philippians 4:19 NLT",
        received="Father, I thank you that every rand is already in place.",
        praise="Thank you Jesus that I give first and still lack nothing.",
    ),
    dict(
        title="The Word",
        request="The whole Bible finished before 31 December. Half of it written by hand. "
                "A verse hidden every day.",
        verse="“I have hidden your word in my heart, that I might not sin against you.”",
        ref="Psalm 119:11 NLT",
        received="Father, I thank you that your word is already in me and already "
                 "coming out of me.",
        praise="Thank you Jesus that your word never returns empty.",
    ),
    dict(
        title="3am · The Secret Place",
        request="That I meet you at 3am every day, and that everything I carry is birthed "
                "and maintained there.",
        verse="“Before daybreak the next morning, Jesus got up and went out to an isolated "
              "place to pray.”",
        ref="Mark 1:35 NLT",
        received="Father, I thank you that I already wake, and that you are already there "
                 "waiting.",
        praise="Thank you Jesus that nothing I carry, I carry alone.",
    ),
    dict(
        title="The House · S2",
        request="100+ members. Leaders on fire. The two buses. Our part in the CRC Cape "
                "Town building.",
        verse="“And each day the Lord added to their fellowship those who were being saved.”",
        ref="Acts 2:47 NLT",
        received="Father, I thank you that the house is already full and the buses are "
                 "already paid for.",
        praise="Thank you Jesus that we are counted among the biggest givers.",
    ),

    # ---- page two -------------------------------------------------------
    dict(
        title="Health",
        request="75 Hard finished without a restart. Gym 4× a week. The dance class booked. "
                "Meals prepped.",
        verse="“I discipline my body like an athlete, training it to do what it should.”",
        ref="1 Corinthians 9:27 NLT",
        received="Father, I thank you that the discipline is already mine.",
        praise="Thank you Jesus for a body that carries your Spirit well.",
    ),
    dict(
        title="Joy &amp; Presence",
        request="The marathon run. My birthday celebrated on 29 October. Remember December "
                "paid for and fully present.",
        verse="“This is the day the LORD has made. We will rejoice and be glad in it.”",
        ref="Psalm 118:24 NLT",
        received="Father, I thank you that the joy is already paid for and already in "
                 "the diary.",
        praise="Thank you Jesus that rest is obedience and not indulgence.",
    ),
    dict(
        title="My Circle",
        request="Five people named and chosen on purpose — who sharpen me, and whom I am "
                "faithfully carrying.",
        verse="“As iron sharpens iron, so a friend sharpens a friend.”",
        ref="Proverbs 27:17 NLT",
        received="Father, I thank you that the right people are already around me.",
        praise="Thank you Jesus that I am someone’s answered prayer too.",
    ),
    dict(
        title="Serentia",
        request="That Serentia stays the place I learn fast and break safely — and that "
                "everything I learn there transfers.",
        verse="“Do not despise these small beginnings, for the LORD rejoices to see the "
              "work begin.”",
        ref="Zechariah 4:10 NLT",
        received="Father, I thank you that nothing I built there was wasted.",
        praise="Thank you Jesus that you waste nothing — not one hour of it.",
    ),
]

BLANKS = 4          # ruled cards to fill in by hand


CSS = """
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --linen:#E8E1D5;  --creme:#EEE4DA;  --sand:#E1D4C2;  --almond:#CEB59E;
  --taupe:#BEB5A9;  --stone:#A78D78;
  --terracotta:#A46447; --umber:#4C362D; --espresso:#291C0E; --cocoa:#6E473B;
}
body{font-family:'Montserrat',sans-serif;-webkit-font-smoothing:antialiased;
     text-rendering:geometricPrecision;}

.page{position:relative;width:210mm;height:297mm;background:#fff;padding:8mm;
      display:grid;grid-template-columns:repeat(2,95mm);grid-template-rows:repeat(4,67.25mm);
      gap:4mm;overflow:hidden;}

.card{position:relative;overflow:hidden;background:var(--linen);
      border:.3mm solid var(--almond);padding:3.4mm 4mm;
      display:flex;flex-direction:column;}

/* title row */
.card .top{display:flex;align-items:baseline;gap:2.5mm;margin-bottom:2mm;
           border-bottom:.3mm solid var(--almond);padding-bottom:1.5mm;}
.card .t{font-size:3.3mm;font-weight:800;letter-spacing:.03em;color:var(--espresso);
         line-height:1.1;}
.card .by{margin-left:auto;font-size:1.85mm;font-weight:800;letter-spacing:.2em;
          color:var(--terracotta);white-space:nowrap;}

.blk{margin-bottom:1.8mm;}
.blk .k{font-size:1.75mm;font-weight:800;letter-spacing:.2em;text-transform:uppercase;
        color:var(--cocoa);margin-bottom:.7mm;}
.blk .v{font-size:2.4mm;line-height:1.36;color:var(--umber);}
.blk.sc .v{color:var(--umber);}
.blk.sc .r{font-size:1.75mm;font-weight:800;letter-spacing:.12em;text-transform:uppercase;
           color:var(--terracotta);margin-top:.7mm;}
.blk.rc{background:var(--sand);margin:0 -1.6mm 1.5mm;padding:1.8mm 1.6mm;}
.blk.rc .k{color:var(--terracotta);}
.blk.rc .v{font-weight:600;color:var(--espresso);}
.blk.pr .v{font-weight:600;}

.stamp{margin-top:auto;display:flex;align-items:flex-end;gap:3mm;}
.stamp .f{flex:1;}
.stamp .f .k{font-size:1.6mm;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
             color:var(--stone);margin-bottom:.4mm;}
.stamp .f .ln{border-bottom:.3mm dotted var(--stone);height:2.6mm;}

/* blank card */
.card.empty .rule{border-bottom:.3mm dotted var(--stone);height:5mm;}
.card.empty .top .t{flex:1;border-bottom:.3mm dotted var(--stone);align-self:flex-end;
                    height:4.4mm;}
.card.empty .lead{font-size:1.75mm;font-weight:800;letter-spacing:.2em;
                  text-transform:uppercase;color:var(--cocoa);margin:1.4mm 0 .7mm;}
"""

PAGE_HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Prayer cards</title><style>{fonts}{css}{extra}</style></head><body>{body}</body></html>
"""

SCREEN_CSS = """
html,body{background:#3B3128;margin:0;padding:0;display:flex;flex-direction:column;
          align-items:center;gap:10mm;padding:10mm;}
.page{box-shadow:0 0 0 1mm rgba(0,0,0,.25);}
"""

PRINT_CSS = """
@page{size:A4 portrait;margin:0;}
html,body{background:#fff;margin:0;padding:0;}
.page{page-break-after:always;break-after:page;}
.page:last-child{page-break-after:auto;break-after:auto;}
@media screen{
  html,body{background:#3B3128;display:flex;flex-direction:column;align-items:center;
            gap:10mm;padding:10mm;}
  .page{box-shadow:0 2mm 6mm rgba(0,0,0,.4);}
}
"""


def card_html(c):
    return f"""
<div class="card">
  <div class="top"><div class="t">{c['title']}</div><div class="by">{DEADLINE}</div></div>
  <div class="blk"><div class="k">Request</div><div class="v">{c['request']}</div></div>
  <div class="blk sc"><div class="k">Scripture</div><div class="v">{c['verse']}</div>
    <div class="r">{c['ref']}</div></div>
  <div class="blk rc"><div class="k">I have received it · Mark 11:24</div>
    <div class="v">{c['received']}</div></div>
  <div class="blk pr"><div class="k">Praise</div><div class="v">{c['praise']}</div></div>
  <div class="stamp">
    <div class="f"><div class="k">Date received</div><div class="ln"></div></div>
    <div class="f" style="flex:.62"><div class="k">Time</div><div class="ln"></div></div>
  </div>
</div>"""


def blank_html():
    return f"""
<div class="card empty">
  <div class="top"><div class="t" style="color:var(--stone)">&nbsp;</div>
    <div class="by">{DEADLINE}</div></div>
  <div class="lead" style="margin-top:0">Request</div>
  <div class="rule"></div>
  <div class="lead">Scripture</div>
  <div class="rule"></div>
  <div class="lead">I have received it · Mark 11:24</div>
  <div class="rule"></div>
  <div class="lead">Praise</div>
  <div class="rule"></div>
  <div class="stamp">
    <div class="f"><div class="k">Date received</div><div class="ln"></div></div>
    <div class="f" style="flex:.62"><div class="k">Time</div><div class="ln"></div></div>
  </div>
</div>"""


def main():
    cells = [card_html(c) for c in CARDS] + [blank_html() for _ in range(BLANKS)]
    pages = [cells[i:i + PER_PAGE] for i in range(0, len(cells), PER_PAGE)]
    body = "".join(f'<div class="page">{"".join(p)}</div>' for p in pages)

    for name, extra in (("cards.html", SCREEN_CSS), ("print.html", PRINT_CSS)):
        html = PAGE_HTML.format(fonts=font_css(), css=CSS, extra=extra, body=body)
        (HERE / name).write_text(html, encoding="utf-8")
        print(f"  {name}  ({len(html)/1024:.0f} kB)")
    print(f"  {len(CARDS)} written + {BLANKS} blank = {len(cells)} cards "
          f"on {len(pages)} page(s)")


if __name__ == "__main__":
    print("building…")
    main()
    print("done.")
