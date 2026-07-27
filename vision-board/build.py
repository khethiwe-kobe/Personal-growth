#!/usr/bin/env python3
"""
2026 — INVASION — THE SECOND WAVE — LOVE
Vision board builder.

Emits three self-contained HTML files (fonts embedded as base64 so print is
pixel-exact and nothing is fetched from the network):

  board.html          A0 landscape preview — how the finished canvas will look
  print-banner.html   4 x A4 LANDSCAPE sheets (the headline strip)
  print-cards.html    10 x A4 PORTRAIT sheets (the vision cards)

Geometry
--------
A0 landscape is 1189 x 841 mm.
  * 4 x A4 landscape (297 x 210) = 1188 mm — the headline strip, full width.
  * 10 x A4 portrait (210 x 297) in a 5 x 2 grid underneath.
Every sheet is a whole, self-contained card: no word is ever cut by a seam,
so trimming and pasting is forgiving. Sheet C10 carries two half-height panels
(Relationships above, The Rhythm below) on the one A4 page.

Typefaces
---------
Mairo      CRC's brand hand — every script title, every pull-quote.
Montserrat CRC's brand sans — everything structural.

Scripture is NLT throughout, except Ephesians 3:20-21 which is AMP as asked.
The Dream of CRC is reproduced verbatim from crcchurch.com, typos and all.

Run:  python3 build.py
"""

import base64
import pathlib

HERE = pathlib.Path(__file__).parent
FONTS = HERE / "fonts"


# --------------------------------------------------------------------------
# Fonts — embedded so the printed output never depends on the network
# --------------------------------------------------------------------------

def _data_uri(path, mime):
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode()


def font_css():
    mont = _data_uri(FONTS / "Montserrat-latin.woff2", "font/woff2")
    mont_ext = _data_uri(FONTS / "Montserrat-latin-ext.woff2", "font/woff2")
    mairo = _data_uri(FONTS / "Mairo.otf", "font/otf")
    return f"""
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont_ext}) format('woff2');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}}
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont}) format('woff2');}}
@font-face{{font-family:'Mairo';font-weight:400;src:url({mairo}) format('opentype');}}
"""


# --------------------------------------------------------------------------
# Design system
# --------------------------------------------------------------------------

BASE_CSS = """
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  /* palette lifted from the reference swatches */
  --linen:#E8E1D5;   --creme:#EEE4DA;   --sand:#E1D4C2;   --almond:#CEB59E;
  --taupe:#BEB5A9;   --stone:#A78D78;
  --terracotta:#A46447; --umber:#4C362D; --espresso:#291C0E; --cocoa:#6E473B;
  --sage:#88937B;    --burgundy:#4D0E13;
  /* CRC brand — used only on the two CRC sheets */
  --crc-navy:#0A1130; --crc-blue:#5CB2ED; --crc-ink:#3E97DE; --crc-sky:#A8D2F4;
  --crc-off:#F9F9F9;
}
body{font-family:'Montserrat',sans-serif;-webkit-font-smoothing:antialiased;
     text-rendering:geometricPrecision;}

/* ---------- shared card shell ---------- */
.card{position:relative;overflow:hidden;background:var(--linen);color:var(--umber);}
.card.portrait{width:210mm;height:297mm;padding:13mm 12mm 11mm;}
.card.flush{padding:0;}
.tile{position:relative;overflow:hidden;width:297mm;height:210mm;
      background:var(--espresso);color:var(--linen);
      display:flex;flex-direction:column;align-items:center;justify-content:center;
      padding:16mm 14mm;text-align:center;}
/* the four sheets share one internal grid so the strip reads as a single line */
.tile .band{height:78mm;display:flex;align-items:center;justify-content:center;width:100%;}

/* paper texture: a whisper of tooth so flat inks don't look dead in print */
.card::after,.tile::after{content:'';position:absolute;inset:0;pointer-events:none;
  opacity:.5;mix-blend-mode:multiply;
  background-image:radial-gradient(circle at 18% 22%,rgba(76,54,45,.05) 0 38%,transparent 39%),
                   radial-gradient(circle at 78% 68%,rgba(76,54,45,.04) 0 42%,transparent 43%);}
.tile::after{mix-blend-mode:screen;
  background-image:radial-gradient(circle at 22% 18%,rgba(232,225,213,.05) 0 40%,transparent 41%),
                   radial-gradient(circle at 80% 78%,rgba(164,100,71,.10) 0 45%,transparent 46%);}
.card.crc-dna::after,.card.crc-dream::after{display:none;}

/* ---------- type ---------- */
.eyebrow{font-size:2.5mm;font-weight:600;letter-spacing:.42em;text-transform:uppercase;
         color:var(--terracotta);}
/* Mairo's descenders drop well below the line box — script titles need clearance
   under them, so give any title an explicit bottom margin, never 1mm. */
.script{font-family:'Mairo',cursive;font-weight:400;line-height:1.06;color:var(--espresso);}
.h-mod{font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--espresso);}

.rule{height:.35mm;background:var(--almond);width:100%;}

/* ---------- scripture block ---------- */
.scripture{background:var(--sand);padding:6mm 6.5mm;position:relative;}
.scripture .ref{font-size:2.5mm;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
                color:var(--terracotta);display:block;margin-bottom:2.4mm;}
.scripture .verse{font-size:3.3mm;line-height:1.6;font-weight:400;color:var(--umber);}
.scripture .verse em{font-style:normal;font-weight:600;color:var(--espresso);}
.scripture .verse + .verse{margin-top:2.4mm;}

/* ---------- lists ---------- */
.block-label{font-size:2.4mm;font-weight:700;letter-spacing:.36em;text-transform:uppercase;
             color:var(--cocoa);display:flex;align-items:center;gap:3mm;}
.block-label::after{content:'';flex:1;height:.3mm;background:var(--almond);}

ul.vision{list-style:none;}
ul.vision li{font-size:3.5mm;line-height:1.5;font-weight:500;color:var(--umber);
             padding-left:6mm;position:relative;margin-bottom:2.6mm;}
ul.vision li::before{content:'';position:absolute;left:0;top:1.7mm;
             width:2.2mm;height:2.2mm;border:.4mm solid var(--terracotta);
             border-radius:50%;}
ul.vision li strong{font-weight:700;color:var(--espresso);}

ul.acts{list-style:none;}
ul.acts li{font-size:3.05mm;line-height:1.5;color:var(--umber);margin-bottom:2.4mm;
           padding-left:6mm;position:relative;}
ul.acts li::before{content:'';position:absolute;left:0;top:1.5mm;width:3mm;height:.5mm;
           background:var(--sage);}
ul.acts li b{font-weight:700;color:var(--cocoa);letter-spacing:.04em;}

/* script pull-quote — the breathing space between vision and action */
.pull{text-align:center;padding:2mm 4mm;}
.pull .q{font-family:'Mairo',cursive;font-size:13mm;line-height:1.08;color:var(--terracotta);}
.pull .r{font-size:2.3mm;letter-spacing:.32em;text-transform:uppercase;color:var(--stone);
         margin-top:3.5mm;}

.verse-mini{font-size:2.75mm;line-height:1.5;color:var(--cocoa);}
.verse-mini b{color:var(--terracotta);font-weight:700;letter-spacing:.16em;
              text-transform:uppercase;font-size:2.4mm;}

.declare{background:var(--espresso);color:var(--linen);padding:5mm 6mm;text-align:center;}
.declare .big{font-size:3.6mm;font-weight:800;letter-spacing:.12em;line-height:1.45;
              text-transform:uppercase;}
.declare .small{font-size:2.5mm;letter-spacing:.3em;text-transform:uppercase;
                color:var(--almond);margin-top:2mm;}

.target{display:flex;align-items:baseline;gap:3mm;border-bottom:.3mm dashed var(--almond);
        padding-bottom:2.6mm;margin-bottom:2.6mm;}
.target .num{font-size:7mm;font-weight:800;color:var(--terracotta);
             letter-spacing:-.02em;line-height:1;}
.target .lbl{font-size:2.9mm;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
             color:var(--umber);}
.target .sub{font-size:2.5mm;color:var(--stone);margin-left:auto;letter-spacing:.1em;
             text-align:right;}

.stack{display:flex;flex-direction:column;height:100%;}
.grow{flex:1;}
.foot{display:flex;justify-content:space-between;align-items:center;
      font-size:2.2mm;letter-spacing:.3em;text-transform:uppercase;color:var(--stone);
      border-top:.3mm solid var(--almond);padding-top:3mm;}

/* ---------- sheet C10: two half-height panels on one A4 ---------- */
.card.split{padding:0;display:flex;flex-direction:column;}
.card.split .half{height:148.5mm;padding:11mm 12mm 9mm;display:flex;flex-direction:column;}
.card.split .half.dark{background:var(--espresso);color:var(--linen);}
.card.split .half.dark .block-label{color:var(--almond);}
.card.split .half.dark .block-label::after{background:rgba(232,225,213,.28);}
.card.split .half.dark .eyebrow{color:var(--almond);}
.card.split .half.dark ul.acts li{color:rgba(232,225,213,.88);}
.card.split .half.dark ul.acts li b{color:var(--sand);}
.card.split .half.dark .foot{color:rgba(232,225,213,.45);
                             border-top-color:rgba(232,225,213,.25);}
.card.split .cut{height:.4mm;background:var(--almond);}

/* ==========================================================================
   CRC sheets — CRC's own brand, reproduced from crcchurch.com
   ========================================================================== */

/* C4 — the DNA banner */
.card.crc-dna{background:var(--crc-sky);}
.dna-hero{position:relative;overflow:hidden;height:88mm;padding:13mm 12mm;
  display:flex;flex-direction:column;justify-content:center;
  background:linear-gradient(118deg,#2B2CD4 0%,#2C56C8 22%,#2E7CC4 44%,
                             #1B4C8F 66%,#101F52 84%,#080E30 100%);}
.dna-hero .kicker{font-size:3.4mm;letter-spacing:.02em;color:#fff;font-weight:400;
                  white-space:nowrap;}
.dna-hero .kicker b{font-weight:800;}
.dna-hero .ghost{font-size:16.5mm;font-weight:800;letter-spacing:.01em;line-height:1;
                 color:rgba(255,255,255,.26);margin-top:8mm;white-space:nowrap;}
.dna-hero .ghost span{color:rgba(255,255,255,.44);}
.dna-hero .sig{font-family:'Mairo',cursive;font-size:19mm;line-height:1;color:#fff;
               margin-top:-6mm;white-space:nowrap;}
.dna-body{padding:11mm 12mm 9mm;display:flex;flex-direction:column;height:209mm;}
.vmm-card{background:var(--crc-navy);color:#fff;padding:7mm 8mm;margin-bottom:5.5mm;
  flex:1;display:flex;flex-direction:column;justify-content:center;}
.vmm-card .k{font-size:4.4mm;font-weight:800;letter-spacing:.01em;margin-bottom:3.2mm;}
.vmm-card .v{font-size:3.7mm;line-height:1.55;font-weight:400;color:rgba(255,255,255,.94);}
.vmm-card .v + .v{margin-top:3mm;}
.card.crc-dna .foot{color:#26456E;border-top-color:rgba(10,17,48,.28);}

/* C5 — the dream, exactly as the site sets it */
.card.crc-dream{background:#fff;color:#12193A;}
.dream-bar{background:var(--crc-navy);color:#fff;padding:6.5mm 12mm;
           font-size:5.6mm;font-weight:800;letter-spacing:.01em;}
.dream-body{padding:7.5mm 12mm 8mm;display:flex;flex-direction:column;height:263mm;}
p.dream{font-size:4.15mm;line-height:1.55;margin-bottom:4.4mm;color:#12193A;font-weight:400;}
p.dream b{color:var(--crc-ink);font-weight:700;}
.dream-close{border:.5mm solid var(--crc-ink);padding:4.5mm 5mm;text-align:center;
             margin-top:1mm;}
.dream-close .t{font-size:4mm;font-weight:700;line-height:1.5;color:var(--crc-navy);}
.dream-close .b{font-size:2.4mm;letter-spacing:.3em;text-transform:uppercase;
                color:var(--crc-ink);margin-top:2.4mm;font-weight:700;}
.card.crc-dream .foot{color:#7E8AA8;border-top-color:#D8DEEC;}

/* ---------- headline tiles ---------- */
.tile .word{font-weight:900;letter-spacing:.1em;line-height:.92;color:var(--linen);}
.tile .word.script{font-family:'Mairo',cursive;font-weight:400;letter-spacing:0;
                   color:var(--sand);}
.tile .kicker{font-size:2.6mm;font-weight:600;letter-spacing:.5em;text-transform:uppercase;
              color:var(--terracotta);}
.tile .verse{font-size:2.9mm;line-height:1.6;color:rgba(232,225,213,.74);
             max-width:230mm;font-weight:400;min-height:14mm;}
.tile .verse b{display:block;font-size:2.3mm;letter-spacing:.34em;text-transform:uppercase;
               color:var(--terracotta);margin-top:2.6mm;font-weight:700;}
.tile .hair{width:26mm;height:.6mm;background:var(--terracotta);margin:10mm auto 8mm;}
"""


# --------------------------------------------------------------------------
# 1. The headline strip — 4 sheets, one whole word each (no seam cuts a letter)
# --------------------------------------------------------------------------

TILES = [
    dict(
        kicker="THE YEAR OF",
        word='<div class="word" style="font-size:52mm">2026</div>',
        verse="“He has sent me to tell those who mourn that <em>the time of the "
              "LORD’s favor</em> has come.”",
        ref="ISAIAH 61:2 NLT",
    ),
    dict(
        kicker="AND THE POSTURE IS",
        word='<div class="word" style="font-size:34mm">INVASION</div>',
        verse="“The Kingdom of Heaven has been forcefully advancing.”",
        ref="MATTHEW 11:12 NLT",
    ),
    dict(
        kicker="THIS IS",
        word='<div class="word" style="font-size:25mm;line-height:1.08">THE SECOND<br>WAVE</div>',
        verse="“Now go out where it is deeper, and let down your nets to catch some fish.”",
        ref="LUKE 5:4 NLT",
    ),
    dict(
        kicker="AND THE GREATEST OF THESE",
        word='<div class="word script" style="font-size:70mm">Love</div>',
        verse="“Three things will last forever — faith, hope, and love — and the "
              "greatest of these is love.”",
        ref="1 CORINTHIANS 13:13 NLT",
    ),
]


def tile_html(t, n):
    return f"""
<section class="tile" data-sheet="B{n}">
  <div class="kicker">{t['kicker']}</div>
  <div class="band">{t['word']}</div>
  <div class="hair"></div>
  <div class="verse">{t['verse']}<b>{t['ref']}</b></div>
</section>"""


# --------------------------------------------------------------------------
# 2. The ten cards
# --------------------------------------------------------------------------

def card(inner, cls="", sheet=""):
    return (f'<section class="card portrait {cls}" data-sheet="{sheet}">'
            f'<div class="stack">{inner}</div></section>')


def bare(inner, cls="", sheet=""):
    """A card that lays out its own full-bleed sections."""
    return f'<section class="card portrait flush {cls}" data-sheet="{sheet}">{inner}</section>'


C1 = card(sheet="C1", inner="""
  <div class="eyebrow">Career &amp; Work · 01</div>
  <div class="script" style="font-size:19mm;margin:5mm 0 4mm">Celestiaventi</div>
  <div class="h-mod" style="font-size:3mm;color:var(--cocoa);margin-bottom:5mm">The Calling</div>

  <div class="scripture">
    <span class="ref">Ephesians 3:20–21 · AMP</span>
    <div class="verse">“Now to Him who is able to [carry out His purpose and] do
      <em>superabundantly more than all that we dare ask or think</em> [infinitely beyond our
      greatest prayers, hopes, or dreams], according to His power that is at work within us,
      to Him be the glory in the church and in Christ Jesus throughout all generations
      forever and ever. Amen.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">Purpose</div>
  <div style="font-size:5.2mm;font-weight:800;letter-spacing:.03em;color:var(--espresso);
              line-height:1.3;margin-bottom:5mm">Finance God’s kingdom.</div>

  <div class="block-label" style="margin-bottom:3.5mm">The Truth I Build On</div>
  <ul class="vision">
    <li>You are <strong>working for God</strong> — this is not your company, it is His assignment.</li>
    <li>We need <strong>resources to expand God’s kingdom</strong>. Money is a tool, not a trophy.</li>
    <li><strong>See beyond yourself.</strong> The vision is bigger than your comfort.</li>
  </ul>

  <div class="declare" style="margin:2mm 0 4.5mm;padding:4.2mm 6mm">
    <div class="big" style="font-size:3.4mm">You have the Holy Spirit —<br>you should be the
      best in this industry</div>
    <div class="small">Daniel 1:20 · ten times more capable</div>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">The Standard</div>
  <ul class="vision" style="margin-bottom:2mm">
    <li>Excellence is a witness. Nothing leaves my hands half-finished.</li>
    <li>I carry the room’s standard, not the room’s average.</li>
  </ul>

  <div class="grow"></div>

  <div class="pull" style="padding:1mm 4mm">
    <div class="q" style="font-size:11.5mm">Not by force nor by strength</div>
    <div class="r">Zechariah 4:6 NLT · but by my Spirit</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Deut. 8:18</strong> — “Remember the LORD your God. He is the one who gives you
    power to be successful.”<br>
    <strong>Col. 3:23</strong> — “Work willingly at whatever you do, as though you were
    working for the Lord.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>If it is Monday 06:00,</b> then 90 minutes of deep work on the single
        highest-leverage build task — before email, before anyone else’s agenda.</li>
    <li><b>Before every pitch or negotiation,</b> read Ephesians 3:20–21 out loud.</li>
    <li><b>On every deal,</b> name the kingdom outcome before the profit outcome — in writing.</li>
    <li><b>Every Friday,</b> one hour of sharpening the craft: the skill that makes you
        undeniable in this industry.</li>
  </ul>

  <div class="foot"><span>Celestiaventi</span><span>Sheet C1</span></div>
""")


C2 = card(sheet="C2", inner="""
  <div class="eyebrow">Career &amp; Work · 02</div>
  <div class="h-mod" style="font-size:8.5mm;margin:4mm 0 2mm;line-height:1.1">The Build</div>
  <div class="script" style="font-size:12mm;color:var(--terracotta);margin-bottom:5mm">biggest givers</div>

  <div class="scripture">
    <span class="ref">1 Chronicles 29:3, 14 · NLT</span>
    <div class="verse">“Because of my devotion to the Temple of my God, <em>I am giving all
      of my own private treasures</em> of gold and silver to help in the construction.”</div>
    <div class="verse">“Everything we have has come from you, and we give you only what you
      first gave us!”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Focus</div>
  <ul class="vision">
    <li><strong>CRC CPT building project</strong> — the reason the cashflow exists.</li>
    <li><strong>Talitha Cumi</strong> — the safety house.</li>
    <li>We want to be <strong>the biggest givers</strong>.</li>
  </ul>

  <div class="block-label" style="margin:5mm 0 3.5mm">The Horizon</div>
  <div class="target">
    <span class="num">→</span>
    <span class="lbl">Short term</span>
    <span class="sub">Cashflow</span>
  </div>
  <div style="font-size:3.2mm;line-height:1.55;margin:-1mm 0 4mm 0;color:var(--umber)">
    Build for cashflow — to fund the CRC CPT building project and other kingdom projects.
  </div>
  <div class="target">
    <span class="num">$100M+</span>
    <span class="lbl">Long term</span>
    <span class="sub">Build to sell</span>
  </div>
  <div style="font-size:3.2mm;line-height:1.55;margin:-1mm 0 0 0;color:var(--umber)">
    Build an asset worth selling — so that one signature can fund a generation of ministry.
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">Make our efforts successful</div>
    <div class="r">Psalm 90:17 NLT · yes, make our efforts successful</div>
  </div>

  <div class="grow"></div>

  <div class="block-label" style="margin-bottom:3.5mm">The measure of a good year</div>
  <ul class="vision" style="margin-bottom:2mm">
    <li>The giving line went <strong>up</strong>.</li>
    <li>The business can run <strong>without me</strong> for a week.</li>
    <li>Somebody was funded who could not have funded themselves.</li>
  </ul>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Hab. 2:2</strong> — “Write my answer plainly on tablets, so that a runner can
    carry the correct message to others.”<br>
    <strong>Prov. 13:22</strong> — “Good people leave an inheritance to their
    grandchildren.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>On the 1st of every month,</b> the cashflow number goes on the board — measured,
        not guessed.</li>
    <li><b>When money lands,</b> the building-fund percentage moves first — before any
        other line.</li>
    <li><b>Every quarter,</b> raise the giving line, not the lifestyle line.</li>
    <li><b>Work backwards:</b> $100M → the one metric that must move this quarter →
        this week’s action.</li>
  </ul>

  <div class="foot"><span>Celestiaventi</span><span>Sheet C2</span></div>
""")


C3 = card(sheet="C3", inner="""
  <div class="eyebrow">The House · S2</div>
  <div class="script" style="font-size:30mm;color:var(--espresso);margin:4mm 0 0">S2</div>
  <div class="script" style="font-size:14mm;color:var(--terracotta);margin:1mm 0 6mm;
       line-height:1.12">Structure of<br>breakthrough</div>

  <div class="scripture">
    <span class="ref">John 2:17 · Psalm 92:13 · NLT</span>
    <div class="verse">“<em>Passion for God’s house will consume me.</em>”</div>
    <div class="verse">“For they are transplanted to the LORD’s own house. They flourish in
      the courts of our God.”</div>
  </div>

  <div class="block-label" style="margin:7mm 0 4mm">The Structure</div>
  <ul class="vision">
    <li><strong>100% membership in Reith.</strong></li>
    <li>A bus for <strong>education</strong> &amp; a bus for <strong>Arteria</strong>.</li>
    <li><strong>Leaders on fire</strong> — walking intimately in their walk with God.</li>
    <li>Membership of <strong>100+</strong>.</li>
    <li><strong>Honour and zeal</strong> for the house.</li>
  </ul>

  <div class="block-label" style="margin:6mm 0 4mm">Breakthrough In</div>
  <div style="display:flex;gap:2.5mm;margin-bottom:6mm">
    <div style="flex:1;background:var(--sand);padding:5mm 2mm;text-align:center">
      <div style="font-size:2.8mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">FINANCES</div></div>
    <div style="flex:1.35;background:var(--sand);padding:5mm 2mm;text-align:center">
      <div style="font-size:2.8mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">ACADEMICS<br>&amp; CAREER</div></div>
    <div style="flex:1.15;background:var(--sand);padding:5mm 2mm;text-align:center">
      <div style="font-size:2.8mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">RELATION-<br>SHIPS</div></div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">I will build my church</div>
    <div class="r">Matthew 16:18 NLT · and all the powers of hell will not conquer it</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Acts 2:47</strong> — “Each day the Lord added to their fellowship those who were
    being saved.”<br>
    <strong>Rom. 12:11</strong> — “Never be lazy, but work hard and serve the Lord
    enthusiastically.”<br>
    <strong>Matt. 16:18</strong> — “Upon this rock I will build my church, and all the powers
    of hell will not conquer it.”</span>
  </div>

  <div style="height:6mm"></div>
  <div class="foot"><span>S2 · Structure of Breakthrough</span><span>Sheet C3</span></div>
""")


# --- C4: the DNA of CRC, reproduced from crcchurch.com --------------------

C4 = bare(cls="crc-dna", sheet="C4", inner="""
  <div class="dna-hero">
    <div class="kicker"><b>THE DREAM OF CRC</b> · THE VISION · THE MISSION · THE MANDATE</div>
    <div class="ghost">THE DNA OF <span>CRC</span></div>
    <div class="sig">this is who we are</div>
  </div>
  <div class="dna-body">
    <div class="vmm-card">
      <div class="k">Our Vision</div>
      <div class="v">Our vision is building one church in many locations, nationally and
        internationally!</div>
    </div>
    <div class="vmm-card">
      <div class="k">Our Mission</div>
      <div class="v">Our mission is mend the nets, the catch will be great!</div>
    </div>
    <div class="vmm-card" style="margin-bottom:0;flex:1.25">
      <div class="k">Our Mandate</div>
      <div class="v">Our mandate is to win the lost at any cost!</div>
      <div class="v">Everything we do is about souls as we plunder hell and populate heaven!</div>
    </div>
    <div class="grow"></div>
    <div class="foot"><span>crcchurch.com</span><span>Sheet C4</span></div>
  </div>
""")


# --- C5: the Dream itself, verbatim from the site -------------------------

C5 = bare(cls="crc-dream", sheet="C5", inner="""
  <div class="dream-bar">The Dream of CRC</div>
  <div class="dream-body">
    <p class="dream">It is the <b>dream of CRC to be on oasis of life</b> in this city where
      the hurting, the depressed, the sick, the frustrated and the confused can find love
      acceptance, help, hope, healing, forgiveness, guidance and encouragement.</p>
    <p class="dream">It is our dream to <b>feed the poor, to clothe the naked and to take
      care of orphans and widows.</b></p>
    <p class="dream">It is the <b>dream of CRC to effectively share the Good News of Jesus
      Christ with every man, woman and child.</b></p>
    <p class="dream">It is the dream of CRC to <b>welcome a tithe of each of our cities as
      members</b> into the fellowship of our church family, loving, learning, laughing and
      living in harmony together, fulfilling God’s vision for us.</p>
    <p class="dream">It is the dream of CRC to <b>develop every incoming member to spiritual
      maturity</b>, ministering to the whole man (spirit, soul and body) through small groups,
      seminars, retreats, bible studies and a Bible School for our members.</p>
    <p class="dream">It is the dream of CRC to <b>equip every member for significant
      ministry</b> helping them discover the gifts and talents God has given them.</p>
    <p class="dream">It is the dream of CRC to be a <b>lighthouse to the nations</b> - mission
      base regularly sending out missionaries to the four corners of the earth. It is our
      dream to regularly send out hundreds of career missionaries and church workers oil
      around the world on short tem mission projects.</p>
    <p class="dream">It is our dream to <b>plant several daughter churches every year
      nationally and internationally.</b></p>
    <p class="dream">It is the dream of CRC to have <b>suitable, practical but beautiful
      facilities</b> designed to minister to the total person, spiritually, emotionally,
      physically and socially. These facilities include worship auditoriums seating thousands,
      recreational facilities, children facilities, Bible School, several fellowship halls,
      administration facilities and schools.</p>
    <p class="dream">It is our dream to have <b>a farm with rehabilitation facilities,
      industry warehouses, orphanages, old age homes and several community centres.</b></p>

    <div class="dream-close">
      <div class="t">We confidently state that these dreams will become a reality.<br>
        Because they are inspired by God.</div>
      <div class="b">Pastor At Boshoff</div>
    </div>

    <div class="grow"></div>
    <div class="foot"><span>crcchurch.com</span><span>Sheet C5</span></div>
  </div>
""")


C6 = card(sheet="C6", inner="""
  <div class="eyebrow">The Secret Place · 2026</div>
  <div class="script" style="font-size:22mm;margin:5mm 0 6mm">Spiritual</div>

  <div class="scripture">
    <span class="ref">Mark 1:35 · Joshua 1:8 · NLT</span>
    <div class="verse">“<em>Before daybreak</em> the next morning, Jesus got up and went out
      to an isolated place to pray.”</div>
    <div class="verse">“Study this Book of Instruction continually. Meditate on it day and
      night so you will be sure to obey everything written in it. Only then will you prosper
      and succeed in all you do.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 4mm">The Vision</div>
  <ul class="vision">
    <li><strong>Daily 3am intercession.</strong> Everything is birthed and maintained
        in prayer.</li>
    <li><strong>Finish the whole Bible</strong> before 31 December.</li>
    <li><strong>Memorise scripture daily.</strong></li>
    <li><strong>Rewrite half of the Bible</strong> by hand.</li>
    <li><strong>Intentional weekly evangelism</strong> — share the gospel.</li>
  </ul>

  <div class="declare" style="margin:3mm 0 5mm">
    <div class="big" style="font-size:3.3mm">Everything is birthed and<br>maintained in prayer</div>
    <div class="small">Luke 18:1 · always pray and never give up</div>
  </div>

  <div class="block-label" style="margin-bottom:4mm">What that costs per day</div>
  <div class="target"><span class="num">8</span><span class="lbl">Chapters read</span>
    <span class="sub">1 189 chapters ÷ 157 days</span></div>
  <div class="target"><span class="num">4</span><span class="lbl">Chapters written</span>
    <span class="sub">Half the Bible by 31 Dec</span></div>
  <div class="target" style="border-bottom:none"><span class="num">1</span>
    <span class="lbl">Verse memorised</span><span class="sub">≈157 by year end</span></div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Deut. 17:18–19</strong> — “He must copy for himself this body of instruction on a
    scroll… and read it daily as long as he lives.”<br>
    <strong>Ps. 119:11</strong> — “I have hidden your word in my heart, that I might not sin
    against you.”<br>
    <strong>Mark 16:15</strong> — “Go into all the world and preach the Good News to
    everyone.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>Alarm at 02:50, phone across the room.</b> 03:00 is not a mood, it is an
        appointment — the list of names is written the night before.</li>
    <li><b>Eight chapters before the day starts,</b> four chapters written before it ends.</li>
    <li><b>One verse on the mirror each morning;</b> say it out loud before you leave.</li>
    <li><b>One gospel conversation every week</b> — name the person on Sunday, not
        on Saturday.</li>
  </ul>

  <div class="foot"><span>Birthed and maintained in prayer</span><span>Sheet C6</span></div>
""")


C7 = card(sheet="C7", inner="""
  <div class="eyebrow">Stewardship · Aug–Dec 2026</div>
  <div class="script" style="font-size:24mm;margin:4mm 0 5mm">Finances</div>

  <div class="scripture">
    <span class="ref">Luke 16:10 · Proverbs 21:5 · NLT</span>
    <div class="verse">“If you are faithful in little things, <em>you will be faithful in
      large ones.</em>”</div>
    <div class="verse">“Good planning and hard work lead to prosperity.”</div>
  </div>

  <div class="declare" style="margin:4.5mm 0;padding:4mm 6mm;background:var(--terracotta)">
    <div class="big" style="font-size:3.4mm">Five months. Starting at R0.</div>
    <div class="small" style="color:rgba(238,228,218,.78)">August · September · October ·
      November · December</div>
  </div>

  <div class="block-label" style="margin-bottom:4mm">The Numbers</div>
  <div class="target"><span class="num">R30k</span><span class="lbl">Savings</span>
    <span class="sub"><b style="color:var(--terracotta)">R6 000</b> / month × 5</span></div>
  <div class="target"><span class="num">R50k</span><span class="lbl">Investments</span>
    <span class="sub"><b style="color:var(--terracotta)">R10 000</b> / month × 5</span></div>
  <div class="target" style="border-bottom:none"><span class="num" style="font-size:5mm">LONG</span>
    <span class="lbl">Property investment</span><span class="sub">Deposit fund open</span></div>

  <div style="background:var(--espresso);color:var(--linen);padding:3.6mm 6mm;
       display:flex;align-items:baseline;gap:4mm;margin:2mm 0 4mm">
    <span style="font-size:6.5mm;font-weight:800;color:var(--sand);line-height:1">R16 000</span>
    <span style="font-size:2.7mm;font-weight:600;letter-spacing:.2em;text-transform:uppercase">
      Every month, non-negotiable</span>
    <span style="font-size:2.4mm;color:var(--taupe);margin-left:auto;text-align:right">
      + R3 000 / month for the<br>December trip · Sheet C9</span>
  </div>

  <div class="block-label" style="margin-bottom:4mm">The order every rand follows</div>
  <div style="display:flex;flex-direction:column;gap:2mm">
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">01</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">GIVE</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">The tithe is not mine to budget</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">02</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">SAVE</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">Automated on payday</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">03</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">INVEST</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">Before it can be spent</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--espresso);padding:3mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--almond);letter-spacing:.2em">04</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--linen)">LIVE</span>
      <span style="font-size:2.6mm;color:var(--taupe);margin-left:auto">On what is left, gladly</span></div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:3.5mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Mal. 3:10</strong> — “Bring all the tithes into the storehouse… Try it!
    Put me to the test!”<br>
    <strong>Matt. 6:33</strong> — “Seek the Kingdom of God above all else… and he will give
    you everything you need.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>On payday, before anything else:</b> tithe, then R6 000 to savings, then R10 000
        to investments. Automated — not a monthly decision.</li>
    <li><b>Every Sunday evening,</b> five minutes with the bank app.</li>
    <li><b>If an unplanned expense appears,</b> then it waits 48 hours.</li>
    <li><b>Property:</b> open the deposit account in August.</li>
  </ul>

  <div class="foot"><span>Faithful in little</span><span>Sheet C7</span></div>
""")


C8 = card(sheet="C8", inner="""
  <div class="eyebrow">The Temple · 2026</div>
  <div class="script" style="font-size:25mm;margin:4mm 0 5mm">Health</div>

  <div class="scripture">
    <span class="ref">1 Corinthians 6:19–20 · NLT</span>
    <div class="verse">“Don’t you realize that <em>your body is the temple of the Holy
      Spirit</em>, who lives in you and was given to you by God? You do not belong to
      yourself, for God bought you with a high price. So you must honor God with your body.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Vision</div>
  <ul class="vision">
    <li><strong>Gym 4× a week — minimum.</strong> Four is the floor, not the goal.</li>
    <li><strong>Join dancing classes</strong> — worship with the body, joy as discipline.</li>
    <li><strong>Meal prep healthy meals</strong> — decide once, eat well seven times.</li>
  </ul>

  <div style="display:flex;gap:1.6mm;margin:4mm 0 5mm">
    <div style="flex:1;background:var(--sage);color:var(--creme);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">MON</div>
    <div style="flex:1;background:var(--sage);color:var(--creme);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">TUE</div>
    <div style="flex:1;background:var(--taupe);color:var(--umber);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">WED</div>
    <div style="flex:1;background:var(--sage);color:var(--creme);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">THU</div>
    <div style="flex:1;background:var(--taupe);color:var(--umber);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">FRI</div>
    <div style="flex:1;background:var(--sage);color:var(--creme);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">SAT</div>
    <div style="flex:1;background:var(--taupe);color:var(--umber);padding:3.4mm 1mm;
      text-align:center;font-size:2.5mm;font-weight:700;letter-spacing:.14em">SUN</div>
  </div>

  <div class="declare" style="margin-bottom:5mm">
    <div class="big" style="font-size:3.2mm">Discipline in the body<br>is discipline everywhere else</div>
    <div class="small">1 Cor. 9:27 · training it to do what it should</div>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">The Non-Negotiables</div>
  <ul class="vision" style="margin-bottom:1mm">
    <li>Water and protein before coffee.</li>
    <li>Asleep by the hour that makes 03:00 and 4× a week possible.</li>
    <li>Sunday is prep day — the week is won on Sunday afternoon.</li>
  </ul>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">He gives power to the weak</div>
    <div class="r">Isaiah 40:29 NLT · and strength to the powerless</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>1 Cor. 9:27</strong> — “I discipline my body like an athlete, training it to do
    what it should.”<br>
    <strong>3 John 1:2</strong> — “I hope all is well with you and that you are as healthy in
    body as you are strong in spirit.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>If it is the night before a gym day,</b> then the bag is packed and by the door.
        The decision is made while you are still willing.</li>
    <li><b>If you miss a session,</b> then never miss two in a row.</li>
    <li><b>Every Sunday 16:00,</b> meal prep for the next four days.</li>
    <li><b>Book and pay for the dance class</b> — a paid class is a kept class.</li>
  </ul>

  <div class="foot"><span>Honor God with your body</span><span>Sheet C8</span></div>
""")


C9 = card(sheet="C9", inner="""
  <div class="eyebrow">Joy &amp; Presence · 2026</div>
  <div class="script" style="font-size:25mm;margin:4mm 0 5mm">Social</div>

  <div class="scripture">
    <span class="ref">Psalm 118:24 · Ecclesiastes 3:4 · NLT</span>
    <div class="verse">“This is the day the LORD has made. <em>We will rejoice and be glad
      in it.</em>”</div>
    <div class="verse">“A time to cry and a time to laugh. A time to grieve and a time
      to dance.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 4mm">The three dates</div>
  <div style="display:flex;gap:2mm;margin-bottom:5mm">
    <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:5.4mm;font-weight:800;color:var(--terracotta);line-height:1">OCT</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.16em;color:var(--umber);
        margin-top:1.8mm">MARATHON</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.4mm;line-height:1.4">
        Week 1 starts<br>this week</div></div>
    <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:5.4mm;font-weight:800;color:var(--terracotta);line-height:1">29 OCT</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.16em;color:var(--umber);
        margin-top:1.8mm">BIRTHDAY</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.4mm;line-height:1.4">
        Booked by<br>17 September</div></div>
    <div style="flex:1.35;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:5.4mm;font-weight:800;color:var(--terracotta);line-height:1">30 NOV<span
        style="font-size:3.4mm"> – </span>9 DEC</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.16em;color:var(--umber);
        margin-top:1.8mm">REMEMBER DECEMBER</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.4mm;line-height:1.4">
        Summer vacation</div></div>
  </div>

  <div class="block-label" style="margin-bottom:4mm">Remember December · the money</div>
  <div class="target"><span class="num">R3k</span><span class="lbl">Deposit</span>
    <span class="sub">Due by 31 August</span></div>
  <div class="target"><span class="num">R12k</span><span class="lbl">Total for the trip</span>
    <span class="sub">R3 000 / month · Sep, Oct, Nov</span></div>

  <div class="declare" style="margin:3mm 0 5mm;background:var(--terracotta)">
    <div class="big" style="font-size:3.3mm">Rest and celebration are<br>obedience, not indulgence</div>
    <div class="small" style="color:rgba(238,228,218,.75)">Exodus 20:8 · keep the Sabbath holy</div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q" style="font-size:11mm">The joy of the LORD is your strength</div>
    <div class="r">Nehemiah 8:10 NLT · don’t be dejected and sad</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Heb. 12:1</strong> — “Let us run with endurance the race God has set before us.”<br>
    <strong>Isa. 40:31</strong> — “They will run and not grow weary. They will walk and
    not faint.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>Register and pay for the marathon this week</b> — the entry fee is the
        commitment device. Ten weeks of training, long run every Saturday.</li>
    <li><b>By 31 August,</b> the R3 000 deposit is paid and the dates are locked with
        whoever is coming.</li>
    <li><b>By 17 September,</b> the birthday venue is booked and the invitations are sent.
        You do not get celebrated by accident.</li>
    <li><b>30 Nov – 9 Dec:</b> out of office means out of office. Fully present, fully in.</li>
  </ul>

  <div class="foot"><span>A time to dance</span><span>Sheet C9</span></div>
""")


# --- C10: two half-height panels on one A4 --------------------------------

C10 = bare(cls="split", sheet="C10", inner="""
  <div class="half">
    <div class="eyebrow">People · 2026</div>
    <div class="script" style="font-size:17mm;margin:3mm 0 3.5mm">Relationships</div>
    <div class="h-mod" style="font-size:3mm;color:var(--cocoa);margin-bottom:4mm">
      Build your circle</div>

    <div class="scripture" style="padding:4.5mm 5mm">
      <span class="ref">Proverbs 27:17 · Proverbs 13:20 · NLT</span>
      <div class="verse" style="font-size:3.1mm">“<em>As iron sharpens iron, so a friend
        sharpens a friend.</em>”</div>
      <div class="verse" style="font-size:3.1mm">“Walk with the wise and become wise;
        associate with fools and get in trouble.”</div>
    </div>

    <div style="display:flex;gap:6mm;margin-top:4.5mm">
      <div style="flex:1.05">
        <div class="block-label" style="margin-bottom:3mm">The Vision</div>
        <ul class="vision" style="margin-bottom:0">
          <li style="font-size:3.1mm;margin-bottom:2mm">A circle chosen <strong>on
            purpose</strong> — not inherited by proximity.</li>
          <li style="font-size:3.1mm;margin-bottom:2mm">People <strong>ahead of me</strong>
            in something, unafraid to say so.</li>
          <li style="font-size:3.1mm;margin-bottom:0">People I am <strong>faithfully
            carrying</strong> — I am someone’s answered prayer too.</li>
        </ul>
      </div>
      <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 4.5mm">
        <div style="font-size:2.3mm;font-weight:700;letter-spacing:.28em;
          color:var(--terracotta);text-transform:uppercase;margin-bottom:3mm">The five names</div>
        <div style="display:flex;flex-direction:column;gap:3.6mm">
          <div style="border-bottom:.3mm dashed var(--stone);height:4mm"></div>
          <div style="border-bottom:.3mm dashed var(--stone);height:4mm"></div>
          <div style="border-bottom:.3mm dashed var(--stone);height:4mm"></div>
          <div style="border-bottom:.3mm dashed var(--stone);height:4mm"></div>
          <div style="border-bottom:.3mm dashed var(--stone);height:4mm"></div>
        </div>
      </div>
    </div>

    <div class="grow"></div>

    <ul class="acts" style="margin-bottom:3mm">
      <li><b>One intentional conversation a week</b> — not a text, a conversation.</li>
      <li><b>One gathering a month that I host.</b> Be the one who makes the table.</li>
      <li><b>If someone comes to mind,</b> then reach out the same day. That prompting is
          usually not random. <i>Prov. 17:17 — “A friend is always loyal.”</i></li>
    </ul>

    <div class="foot"><span>Iron sharpens iron</span><span>Sheet C10 · upper</span></div>
  </div>

  <div class="cut"></div>

  <div class="half dark">
    <div class="eyebrow">How this board works</div>
    <div class="script" style="font-size:13.5mm;margin:1.5mm 0 4mm;color:var(--linen)">The Rhythm</div>
    <div class="h-mod" style="font-size:2.7mm;color:var(--almond);margin-bottom:3.4mm">
      What the research says makes a vision actually happen</div>

    <div style="background:rgba(232,225,213,.10);padding:3.4mm 5mm;margin-bottom:4mm">
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.3em;color:var(--sand);
        text-transform:uppercase;margin-bottom:2.4mm">Habakkuk 2:2–3 · NLT</div>
      <div style="font-size:3.05mm;line-height:1.5;color:rgba(232,225,213,.92)">
        “<b>Write my answer plainly on tablets, so that a runner can carry the correct
        message to others.</b> If it seems slow in coming, wait patiently, for it will surely
        take place.”</div>
    </div>

    <div style="display:flex;gap:6mm">
      <div style="flex:1">
        <div class="block-label" style="margin-bottom:3mm">Six findings this board is built on</div>
        <ul class="acts" style="margin-bottom:0">
          <li style="font-size:2.55mm;margin-bottom:1.45mm"><b>Write it, don’t wish it.</b>
            Matthews, Dominican University — goals written, action commitments written,
            weekly progress sent to a friend: ~76% achieved vs 43%.</li>
          <li style="font-size:2.55mm;margin-bottom:1.45mm"><b>Picture the process, not the
            prize.</b> Pham &amp; Taylor, UCLA — rehearsing the studying beat picturing the
            grade.</li>
          <li style="font-size:2.55mm;margin-bottom:1.45mm"><b>Contrast the wish with the
            obstacle.</b> Oettingen’s WOOP — fantasy alone predicts less achievement.</li>
          <li style="font-size:2.55mm;margin-bottom:1.45mm"><b>“If–then” beats intention.</b>
            Gollwitzer &amp; Sheeran, 94 studies — naming when and where you act.</li>
          <li style="font-size:2.55mm;margin-bottom:1.45mm"><b>Specific and hard beats “do
            your best.”</b> Locke &amp; Latham — vague goals produce vague effort.</li>
          <li style="font-size:2.55mm;margin-bottom:0"><b>Look daily.</b> A goal you see is
            a goal your mind keeps solving in the background.</li>
        </ul>
      </div>
      <div style="flex:.72">
        <div class="block-label" style="margin-bottom:3mm">The cadence</div>
        <ul class="acts" style="margin-bottom:0">
          <li style="font-size:2.55mm;margin-bottom:2mm"><b>Daily · 60 seconds.</b>
            Read the headline out loud. Name one thing today that serves it.</li>
          <li style="font-size:2.55mm;margin-bottom:2mm"><b>Weekly · Sunday 18:00.</b>
            Ten minutes at the board — then send it to one person who will ask about it.</li>
          <li style="font-size:2.55mm;margin-bottom:2mm"><b>Monthly.</b> The numbers:
            R16 000 moved, gym sessions, chapters read, membership.</li>
          <li style="font-size:2.55mm;margin-bottom:0"><b>Quarterly.</b> Re-read Sheet C5.
            Adjust the plan, never the purpose.</li>
        </ul>
      </div>
    </div>

    <div class="grow"></div>

    <div style="background:rgba(232,225,213,.12);padding:2.8mm 5mm;text-align:center;
         margin-bottom:3mm">
      <span style="font-size:3.1mm;font-weight:800;letter-spacing:.1em;color:var(--sand);
        text-transform:uppercase">Commit your actions to the LORD, and your plans will succeed</span>
      <span style="font-size:2.2mm;letter-spacing:.3em;text-transform:uppercase;
        color:var(--stone);margin-left:3mm">Proverbs 16:3 NLT</span>
    </div>

    <div class="foot"><span>Make it plain · run with it</span><span>Sheet C10 · lower</span></div>
  </div>
""")


CARDS = [C1, C2, C3, C4, C5, C6, C7, C8, C9, C10]


# --------------------------------------------------------------------------
# Output files
# --------------------------------------------------------------------------

HEAD = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{title}</title><style>{fonts}{base}{extra}</style></head><body class="{body}">"""


BOARD_CSS = """
html,body{background:#3B3128;display:flex;align-items:flex-start;justify-content:center;
          padding:0;margin:0;}
.a0{position:relative;width:1189mm;height:841mm;background:var(--creme);
    display:flex;flex-direction:column;overflow:hidden;
    box-shadow:0 0 0 1mm rgba(0,0,0,.25);}
.banner-row{display:flex;width:1189mm;height:210mm;}
.banner-row .tile{width:297.25mm;}
.grid{flex:1;display:grid;grid-template-columns:repeat(5,210mm);
      grid-template-rows:297mm 297mm;justify-content:space-between;align-content:space-between;
      padding:14mm 24mm 10mm;column-gap:0;row-gap:0;}
.a0 .card{box-shadow:0 1.2mm 3mm rgba(41,28,14,.20);}
.a0 .tile{box-shadow:none;}
.banner-row .tile + .tile{box-shadow:inset .35mm 0 0 rgba(232,225,213,.10);}
"""

PRINT_CSS_PORTRAIT = """
@page{size:A4 portrait;margin:0;}
html,body{background:#fff;margin:0;padding:0;}
.card{page-break-after:always;break-after:page;box-shadow:none;}
.card:last-child{page-break-after:auto;break-after:auto;}
@media screen{
  html,body{background:#3B3128;}
  body{display:flex;flex-direction:column;align-items:center;gap:10mm;padding:10mm;}
  .card{box-shadow:0 2mm 6mm rgba(0,0,0,.4);}
}
"""

PRINT_CSS_LANDSCAPE = """
@page{size:A4 landscape;margin:0;}
html,body{background:#fff;margin:0;padding:0;}
.tile{page-break-after:always;break-after:page;}
.tile:last-child{page-break-after:auto;break-after:auto;}
@media screen{
  html,body{background:#3B3128;}
  body{display:flex;flex-direction:column;align-items:center;gap:10mm;padding:10mm;}
  .tile{box-shadow:0 2mm 6mm rgba(0,0,0,.4);}
}
"""


def write(name, title, extra_css, body_html, body_class=""):
    html = HEAD.format(title=title, fonts=font_css(), base=BASE_CSS,
                       extra=extra_css, body=body_class)
    html += body_html + "\n</body></html>\n"
    (HERE / name).write_text(html, encoding="utf-8")
    print(f"  {name}  ({len(html)/1024:.0f} kB)")


def main():
    tiles = "".join(tile_html(t, i + 1) for i, t in enumerate(TILES))
    cards = "".join(CARDS)

    print("building…")
    write("board.html", "2026 · INVASION · THE SECOND WAVE · LOVE — A0 preview",
          BOARD_CSS,
          f'<div class="a0"><div class="banner-row">{tiles}</div>'
          f'<div class="grid">{cards}</div></div>')

    write("print-banner.html", "Print — headline strip (4 × A4 landscape)",
          PRINT_CSS_LANDSCAPE, tiles)

    write("print-cards.html", "Print — vision cards (10 × A4 portrait)",
          PRINT_CSS_PORTRAIT, cards)

    print("done.")


if __name__ == "__main__":
    main()
