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
so trimming and pasting is forgiving.

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
    parslay = _data_uri(FONTS / "Parslay.otf", "font/otf")
    mairo = _data_uri(FONTS / "Mairo.otf", "font/otf")
    return f"""
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont_ext}) format('woff2');
  unicode-range:U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+1E00-1E9F,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF;}}
@font-face{{font-family:'Montserrat';font-style:normal;font-weight:100 900;
  src:url({mont}) format('woff2');}}
@font-face{{font-family:'Parslay';font-weight:400;src:url({parslay}) format('opentype');}}
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
  /* CRC brand — used only on the Dream of CRC cards */
  --crc-navy:#080E36; --crc-blue:#5CB2ED; --crc-off:#F9F9F9;
}
body{font-family:'Montserrat',sans-serif;-webkit-font-smoothing:antialiased;
     text-rendering:geometricPrecision;}

/* ---------- shared card shell ---------- */
.card{position:relative;overflow:hidden;background:var(--linen);color:var(--umber);}
.card.portrait{width:210mm;height:297mm;padding:13mm 12mm 11mm;}
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

/* ---------- type ---------- */
.eyebrow{font-size:2.5mm;font-weight:600;letter-spacing:.42em;text-transform:uppercase;
         color:var(--terracotta);}
.script{font-family:'Parslay',cursive;font-weight:400;line-height:.98;color:var(--espresso);}
.mairo{font-family:'Mairo',cursive;font-weight:400;line-height:1;}
.h-mod{font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--espresso);}

.rule{height:.35mm;background:var(--almond);width:100%;}
.rule.short{width:18mm;height:.7mm;background:var(--terracotta);}

/* ---------- scripture block ---------- */
.scripture{background:var(--sand);padding:6mm 6.5mm;position:relative;}
.scripture .ref{font-size:2.5mm;font-weight:700;letter-spacing:.3em;text-transform:uppercase;
                color:var(--terracotta);display:block;margin-bottom:2.4mm;}
.scripture .verse{font-size:3.35mm;line-height:1.62;font-weight:400;color:var(--umber);}
.scripture .verse em{font-style:normal;font-weight:600;color:var(--espresso);}

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
.pull .q{font-family:'Parslay',cursive;font-size:12mm;line-height:1.06;color:var(--terracotta);}
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
.target .num{font-family:'Montserrat';font-size:7mm;font-weight:800;color:var(--terracotta);
             letter-spacing:-.02em;line-height:1;}
.target .lbl{font-size:2.9mm;font-weight:600;letter-spacing:.16em;text-transform:uppercase;
             color:var(--umber);}
.target .sub{font-size:2.5mm;color:var(--stone);margin-left:auto;letter-spacing:.1em;}

.stack{display:flex;flex-direction:column;height:100%;}
.grow{flex:1;}
.foot{display:flex;justify-content:space-between;align-items:center;
      font-size:2.2mm;letter-spacing:.3em;text-transform:uppercase;color:var(--stone);
      border-top:.3mm solid var(--almond);padding-top:3mm;}

/* ---------- CRC dream cards ---------- */
.card.crc{background:var(--crc-navy);color:var(--crc-off);}
.card.crc::after{mix-blend-mode:screen;
  background-image:radial-gradient(circle at 20% 15%,rgba(92,178,237,.10) 0 40%,transparent 41%),
                   radial-gradient(circle at 82% 84%,rgba(92,178,237,.07) 0 42%,transparent 43%);}
.card.crc .eyebrow{color:var(--crc-blue);}
.card.crc .rule{background:rgba(249,249,249,.18);}
.card.crc .crc-lock{display:flex;align-items:baseline;gap:6mm;}
.card.crc .crc-lock .s{font-family:'Parslay',cursive;font-size:13mm;color:var(--crc-off);
                       line-height:.9;}
.card.crc .crc-lock .m{font-size:9mm;font-weight:800;letter-spacing:.06em;color:var(--crc-blue);}
.card.crc p.dream{font-size:3.32mm;line-height:1.66;color:rgba(249,249,249,.9);
                  margin-bottom:4.2mm;font-weight:400;}
.card.crc p.dream::first-letter{color:var(--crc-blue);font-weight:700;}
.card.crc .vmm{margin-bottom:4mm;}
.card.crc .vmm .k{font-size:2.4mm;font-weight:700;letter-spacing:.34em;text-transform:uppercase;
                  color:var(--crc-blue);margin-bottom:1.2mm;}
.card.crc .vmm .v{font-size:3.6mm;font-weight:600;line-height:1.45;color:var(--crc-off);}
.card.crc .foot{color:rgba(249,249,249,.45);border-top-color:rgba(249,249,249,.18);}
/* sheet C4 carries less copy than C5, so it is set larger to fill the page evenly */
.card.crc.roomy p.dream{font-size:4.2mm;line-height:1.66;margin-bottom:5.4mm;}
.card.crc.roomy .vmm{margin-bottom:4.6mm;}
.card.crc.roomy .vmm .v{font-size:4.05mm;line-height:1.45;}
.card.crc.roomy .crc-lock .s{font-size:15mm;}
.card.crc.roomy .crc-lock .m{font-size:10.5mm;}

.card.crc .closing{border:.4mm solid var(--crc-blue);padding:4.5mm 5mm;text-align:center;}
.card.crc .closing .t{font-size:3.3mm;font-weight:700;letter-spacing:.06em;line-height:1.45;}
.card.crc .closing .b{font-size:2.5mm;letter-spacing:.3em;text-transform:uppercase;
                      color:var(--crc-blue);margin-top:2mm;}

/* ---------- headline tiles ---------- */
.tile .word{font-weight:900;letter-spacing:.1em;line-height:.92;color:var(--linen);}
.tile .word.script{font-family:'Parslay',cursive;font-weight:400;letter-spacing:0;
                   color:var(--sand);}
.tile .kicker{font-size:2.6mm;font-weight:600;letter-spacing:.5em;text-transform:uppercase;
              color:var(--terracotta);}
.tile .verse{font-size:2.9mm;line-height:1.6;color:rgba(232,225,213,.74);
             max-width:210mm;font-weight:400;min-height:14mm;}
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
        verse="“To proclaim the acceptable year of the <em>LORD</em>.”",
        ref="ISAIAH 61:2",
    ),
    dict(
        kicker="AND THE POSTURE IS",
        word='<div class="word" style="font-size:34mm">INVASION</div>',
        verse="“The kingdom of heaven suffereth violence, and the violent take it by force.”",
        ref="MATTHEW 11:12",
    ),
    dict(
        kicker="THIS IS",
        word='<div class="word" style="font-size:25mm;line-height:1.08">THE SECOND<br>WAVE</div>',
        verse="“Launch out into the deep, and let down your nets for a draught.”",
        ref="LUKE 5:4",
    ),
    dict(
        kicker="AND THE GREATEST OF THESE",
        word='<div class="word script" style="font-size:62mm">Love</div>',
        verse="“And now abideth faith, hope, love, these three; but the greatest of these is love.”",
        ref="1 CORINTHIANS 13:13",
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
    return f'<section class="card portrait {cls}" data-sheet="{sheet}"><div class="stack">{inner}</div></section>'


C1 = card(sheet="C1", inner="""
  <div class="eyebrow">Career &amp; Work · 01</div>
  <div class="script" style="font-size:21mm;margin:4mm 0 1mm">Celestiaventi</div>
  <div class="h-mod" style="font-size:3mm;color:var(--cocoa);margin-bottom:5mm">The Calling</div>

  <div class="scripture">
    <span class="ref">Ephesians 3:20–21</span>
    <div class="verse">“Now unto him that is able to do <em>exceeding abundantly above</em>
      all that we ask or think, according to the power that worketh in us, unto him be glory
      in the church by Christ Jesus throughout all ages, world without end. Amen.”</div>
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

  <div class="declare" style="margin:2mm 0 5mm">
    <div class="big">You have the Holy Spirit —<br>you should be the best in this industry</div>
    <div class="small">Daniel 1:20 · ten times better</div>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">The Standard</div>
  <ul class="vision" style="margin-bottom:2mm">
    <li>Excellence is a witness. Nothing leaves my hands half-finished.</li>
    <li>I carry the room’s standard, not the room’s average.</li>
  </ul>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">Not by might, nor by power</div>
    <div class="r">Zechariah 4:6 · but by my Spirit</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Deut. 8:18</strong> — “It is he that giveth thee power to get wealth, that he may
    establish his covenant.”<br>
    <strong>Col. 3:23</strong> — “Whatsoever ye do, do it heartily, as to the Lord, and not unto men.”</span>
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
  <div class="h-mod" style="font-size:8.5mm;margin:4mm 0 1.5mm;line-height:1.1">The Build</div>
  <div class="script" style="font-size:11mm;color:var(--terracotta);margin-bottom:5mm">biggest givers</div>

  <div class="scripture">
    <span class="ref">1 Chronicles 29:3, 14</span>
    <div class="verse">“Because I have set my affection to the house of my God… <em>I have given
      to the house of my God</em>… for all things come of thee, and of thine own have we
      given thee.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Focus</div>
  <ul class="vision">
    <li><strong>CRC CPT building project</strong> — the reason the cashflow exists.</li>
    <li><strong>Talitha Cumi</strong> — “Damsel, I say unto thee, arise.” <em>Mark 5:41</em></li>
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
    <div class="q">Talitha cumi</div>
    <div class="r">Mark 5:41 · Damsel, I say unto thee, arise</div>
  </div>

  <div class="grow"></div>

  <div class="block-label" style="margin-bottom:3.5mm">The measure of a good year</div>
  <ul class="vision" style="margin-bottom:1mm">
    <li>The giving line went <strong>up</strong>.</li>
    <li>The business can run <strong>without me</strong> for a week.</li>
    <li>Somebody was funded who could not have funded themselves.</li>
  </ul>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Hab. 2:2</strong> — “Write the vision, and make it plain upon tables, that he may
    run that readeth it.”<br>
    <strong>Prov. 13:22</strong> — “A good man leaveth an inheritance to his children’s children.”</span>
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
  <div class="mairo" style="font-size:26mm;color:var(--espresso);margin:3mm 0 0">S2</div>
  <div class="mairo" style="font-size:12mm;color:var(--terracotta);margin:0 0 5mm;line-height:1.15">
    Structure of<br>breakthrough
  </div>

  <div class="scripture">
    <span class="ref">John 2:17 · Psalm 92:13</span>
    <div class="verse">“The <em>zeal of thine house</em> hath eaten me up.”<br>
      “Those that be planted in the house of the LORD shall flourish in the courts of our God.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Structure</div>
  <ul class="vision">
    <li><strong>100% membership in Reith.</strong></li>
    <li>A bus for <strong>education</strong> &amp; a bus for <strong>Arteria</strong>.</li>
    <li><strong>Leaders on fire</strong> — walking intimately in their walk with God.</li>
    <li>Membership of <strong>100+</strong>.</li>
    <li><strong>Honour and zeal</strong> for the house.</li>
  </ul>

  <div class="block-label" style="margin:5mm 0 3.5mm">Breakthrough In</div>
  <div style="display:flex;gap:2.5mm;margin-bottom:5mm">
    <div style="flex:1;background:var(--sand);padding:4mm 2mm;text-align:center">
      <div style="font-size:2.6mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">FINANCES</div></div>
    <div style="flex:1.35;background:var(--sand);padding:4mm 2mm;text-align:center">
      <div style="font-size:2.6mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">ACADEMICS<br>&amp; CAREER</div></div>
    <div style="flex:1.15;background:var(--sand);padding:4mm 2mm;text-align:center">
      <div style="font-size:2.6mm;font-weight:700;letter-spacing:.18em;color:var(--espresso)">RELATION-<br>SHIPS</div></div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">Here am I; send me</div>
    <div class="r">Isaiah 6:8 · whom shall I send</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Acts 2:47</strong> — “And the Lord added to the church daily such as should be saved.”<br>
    <strong>Rom. 12:11</strong> — “Not slothful in business; fervent in spirit; serving the Lord.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>Every week,</b> leaders pray together before they plan together.</li>
    <li><b>Every month,</b> one honest membership number on the wall — and one new name invited
        into Reith personally, not generally.</li>
    <li><b>For the buses,</b> name the amount, name the date, name who is asking.</li>
    <li><b>When it is easier to complain than to serve,</b> then serve — honour is a
        decision before it is a feeling.</li>
  </ul>

  <div class="foot"><span>S2 · Structure of Breakthrough</span><span>Sheet C3</span></div>
""")


CRC_A = card(cls="crc roomy", sheet="C4", inner="""
  <div class="eyebrow">Christian Revival Church</div>
  <div class="crc-lock" style="margin:4mm 0 1mm"><span class="s">The Dream of</span><span class="m">CRC</span></div>
  <div class="rule" style="margin:4mm 0 6mm"></div>

  <div class="vmm"><div class="k">Our Vision</div>
    <div class="v">Our vision is building one church in many locations,
      nationally and internationally!</div></div>
  <div class="vmm"><div class="k">Our Mission</div>
    <div class="v">Our mission is mend the nets, the catch will be great!</div></div>
  <div class="vmm" style="margin-bottom:6mm"><div class="k">Our Mandate</div>
    <div class="v">Our mandate is to win the lost at any cost! Everything we do is about souls
      as we plunder hell and populate heaven!</div></div>

  <div class="rule" style="margin-bottom:5mm"></div>

  <p class="dream">It is the dream of CRC to be an oasis of life in this city where the hurting,
    the depressed, the sick, the frustrated and the confused can find love, acceptance, help,
    hope, healing, forgiveness, guidance and encouragement.</p>
  <p class="dream">It is our dream to feed the poor, to clothe the naked and to take care of
    orphans and widows.</p>
  <p class="dream">It is the dream of CRC to effectively share the Good News of Jesus Christ
    with every man, woman and child.</p>
  <p class="dream">It is the dream of CRC to welcome a tithe of each of our cities as members
    into the fellowship of our church family, loving, learning, laughing and living in harmony
    together, fulfilling God’s vision for us.</p>
  <p class="dream">It is the dream of CRC to develop every incoming member to spiritual
    maturity, ministering to the whole man (spirit, soul and body) through small groups,
    seminars, retreats, bible studies and a Bible School for our members.</p>
  <p class="dream">It is the dream of CRC to equip every member for significant ministry
    helping them discover the gifts and talents God has given them.</p>
  <p class="dream">It is the dream of CRC to be a lighthouse to the nations — a mission base
    regularly sending out missionaries to the four corners of the earth. It is our dream to
    regularly send out hundreds of career missionaries and church workers all around the world
    on short term mission projects.</p>

  <div class="grow"></div>
  <div class="foot"><span>crcchurch.com</span><span>Sheet C4 · i of ii</span></div>
""")


CRC_B = card(cls="crc", sheet="C5", inner="""
  <div class="eyebrow">Christian Revival Church</div>
  <div class="crc-lock" style="margin:4mm 0 1mm"><span class="s">The Dream of</span><span class="m">CRC</span></div>
  <div class="rule" style="margin:4mm 0 6mm"></div>

  <p class="dream">It is our dream to plant several daughter churches every year nationally
    and internationally.</p>
  <p class="dream">It is the dream of CRC to have suitable, practical but beautiful facilities
    designed to minister to the total person, spiritually, emotionally, physically and socially.
    These facilities include worship auditoriums seating thousands, recreational facilities,
    children facilities, Bible School, several fellowship halls, administration facilities
    and schools.</p>
  <p class="dream">It is our dream to have a farm with rehabilitation facilities, industry
    warehouses, orphanages, old age homes and several community centres.</p>

  <div style="margin:6mm 0 6mm" class="closing">
    <div class="t">We confidently state that these dreams<br>will become a reality.<br>
      Because they are inspired by God.</div>
    <div class="b">Pastor At Boshoff</div>
  </div>

  <div class="rule" style="margin-bottom:5mm"></div>
  <div class="vmm"><div class="k">My part in it</div>
    <div class="v" style="font-size:3.1mm;font-weight:400;line-height:1.55;
        color:rgba(249,249,249,.88)">
      Celestiaventi exists to finance this page. The building project, the buses, the farm,
      the orphanages — these are line items on a balance sheet somebody has to carry.
      I am asking God to make me one of the people who carries them.</div></div>

  <div class="grow"></div>

  <div class="rule" style="margin-bottom:5mm"></div>
  <div class="eyebrow" style="margin-bottom:4mm">My assignment this year</div>
  <ul class="acts" style="margin-bottom:0">
    <li style="color:rgba(249,249,249,.86);font-size:3.1mm">
      <b style="color:var(--crc-blue)">Give first, give most.</b> Be counted among the
      biggest givers to the CRC CPT building project — not by intention, by receipt.</li>
    <li style="color:rgba(249,249,249,.86);font-size:3.1mm">
      <b style="color:var(--crc-blue)">Build the machine that funds it.</b> Cashflow is
      ministry infrastructure.</li>
    <li style="color:rgba(249,249,249,.86);font-size:3.1mm">
      <b style="color:var(--crc-blue)">Bring people, not just money.</b> A tithe of the
      city starts with the names on Sheet C9.</li>
  </ul>

  <div style="height:6mm"></div>
  <div class="foot"><span>crcchurch.com</span><span>Sheet C5 · ii of ii</span></div>
""")


C6 = card(sheet="C6", inner="""
  <div class="eyebrow">Stewardship · 2026</div>
  <div class="script" style="font-size:23mm;margin:4mm 0 5mm">Finances</div>

  <div class="scripture">
    <span class="ref">Proverbs 21:20 · Luke 16:10</span>
    <div class="verse">“There is <em>treasure to be desired</em> and oil in the dwelling of the
      wise; but a foolish man spendeth it up.”<br>
      “He that is faithful in that which is least is faithful also in much.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 4mm">The Numbers</div>
  <div class="target"><span class="num">R30k</span><span class="lbl">Savings</span>
    <span class="sub">R2 500 / month</span></div>
  <div class="target"><span class="num">R50k</span><span class="lbl">Investments</span>
    <span class="sub">R4 200 / month</span></div>
  <div class="target" style="border-bottom:none"><span class="num" style="font-size:5mm">LONG</span>
    <span class="lbl">Property investment</span><span class="sub">Deposit fund open</span></div>

  <div class="block-label" style="margin:5mm 0 4mm">The order every rand follows</div>
  <div style="display:flex;flex-direction:column;gap:2mm">
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3.4mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">01</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">GIVE</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">The tithe is not mine to budget</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3.4mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">02</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">SAVE</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">Automated on payday</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--sand);padding:3.4mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--terracotta);letter-spacing:.2em">03</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--espresso)">INVEST</span>
      <span style="font-size:2.6mm;color:var(--stone);margin-left:auto">Before it can be spent</span></div>
    <div style="display:flex;align-items:center;gap:3mm;background:var(--espresso);padding:3.4mm 4mm">
      <span style="font-size:2.4mm;font-weight:800;color:var(--almond);letter-spacing:.2em">04</span>
      <span style="font-size:3.1mm;font-weight:700;letter-spacing:.14em;color:var(--linen)">LIVE</span>
      <span style="font-size:2.6mm;color:var(--taupe);margin-left:auto">On what is left, gladly</span></div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q" style="font-size:10mm">My God shall supply all your need</div>
    <div class="r">Philippians 4:19 · according to his riches in glory</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Prov. 21:5</strong> — “The thoughts of the diligent tend only to plenteousness.”<br>
    <strong>Mal. 3:10</strong> — “Bring ye all the tithes into the storehouse… and prove me now
    herewith, saith the LORD of hosts, if I will not open you the windows of heaven.”<br>
    <strong>Matt. 6:33</strong> — “Seek ye first the kingdom of God… and all these things shall
    be added unto you.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>On payday, before anything else:</b> tithe, then the savings transfer, then the
        investment transfer. Automated — not a monthly decision.</li>
    <li><b>Every Sunday evening,</b> five minutes with the bank app. Nothing hidden from
        yourself.</li>
    <li><b>If an unplanned expense appears,</b> then it waits 48 hours before it is approved.</li>
    <li><b>Property:</b> open the deposit account this month; learn one area properly
        before you buy anything.</li>
  </ul>

  <div class="foot"><span>Faithful in little</span><span>Sheet C6</span></div>
""")


C7 = card(sheet="C7", inner="""
  <div class="eyebrow">The Temple · 2026</div>
  <div class="script" style="font-size:24mm;margin:4mm 0 5mm">Health</div>

  <div class="scripture">
    <span class="ref">1 Corinthians 6:19–20</span>
    <div class="verse">“Know ye not that your body is the <em>temple of the Holy Ghost</em>
      which is in you, which ye have of God, and ye are not your own? For ye are bought with
      a price: therefore glorify God in your body, and in your spirit, which are God’s.”</div>
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
    <div class="small">1 Cor. 9:27 · bring it into subjection</div>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">The Non-Negotiables</div>
  <ul class="vision" style="margin-bottom:1mm">
    <li>Water and protein before coffee.</li>
    <li>Asleep by the hour that makes 4× a week possible.</li>
    <li>Sunday is prep day — the week is won on Sunday afternoon.</li>
  </ul>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">He giveth power to the faint</div>
    <div class="r">Isaiah 40:29 · and to them that have no might</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>1 Cor. 9:27</strong> — “But I keep under my body, and bring it into subjection.”<br>
    <strong>3 John 1:2</strong> — “I wish above all things that thou mayest prosper and be in
    health, even as thy soul prospereth.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>If it is the night before a gym day,</b> then the bag is packed and by the door.
        The decision is made while you are still willing.</li>
    <li><b>If you miss a session,</b> then never miss two in a row. The rule is not perfection,
        it is no back-to-back misses.</li>
    <li><b>Every Sunday 16:00,</b> meal prep for the next four days — cooking is a
        standing appointment, not a mood.</li>
    <li><b>Book and pay for the dance class</b> — a paid class is a kept class.</li>
  </ul>

  <div class="foot"><span>Glorify God in your body</span><span>Sheet C7</span></div>
""")


C8 = card(sheet="C8", inner="""
  <div class="eyebrow">Joy &amp; Presence · 2026</div>
  <div class="script" style="font-size:24mm;margin:4mm 0 5mm">Social</div>

  <div class="scripture">
    <span class="ref">Psalm 118:24 · Ecclesiastes 3:4</span>
    <div class="verse">“This is the day which the LORD hath made; we will <em>rejoice and be
      glad</em> in it.”<br>“A time to weep, and a time to laugh; a time to mourn,
      and a time to dance.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Vision</div>
  <ul class="vision">
    <li><strong>October marathon</strong> — trained for, finished, celebrated.</li>
    <li><strong>Remember December</strong> — fully present, fully in.</li>
    <li><strong>Celebrate my birthday with friends</strong> — planned early, not squeezed in.</li>
  </ul>

  <div class="declare" style="margin:3mm 0 5mm;background:var(--terracotta)">
    <div class="big" style="font-size:3.3mm">Rest and celebration are<br>obedience, not indulgence</div>
    <div class="small" style="color:rgba(238,228,218,.75)">Exodus 20:8 · Remember the sabbath day</div>
  </div>

  <div class="block-label" style="margin-bottom:4mm">The three dates</div>
  <div style="display:flex;gap:2mm;margin-bottom:2mm">
    <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:6mm;font-weight:800;color:var(--terracotta);line-height:1">OCT</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.18em;color:var(--umber);
        margin-top:1.6mm">MARATHON</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.2mm">16 weeks of training</div></div>
    <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:6mm;font-weight:800;color:var(--terracotta);line-height:1">MY&nbsp;DAY</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.18em;color:var(--umber);
        margin-top:1.6mm">BIRTHDAY</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.2mm">Booked 6 weeks out</div></div>
    <div style="flex:1;border:.4mm solid var(--almond);padding:4mm 2mm;text-align:center">
      <div style="font-size:6mm;font-weight:800;color:var(--terracotta);line-height:1">DEC</div>
      <div style="font-size:2.4mm;font-weight:700;letter-spacing:.18em;color:var(--umber);
        margin-top:1.6mm">REMEMBER</div>
      <div style="font-size:2.3mm;color:var(--stone);margin-top:1.2mm">All in, fully present</div></div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">The joy of the LORD is your strength</div>
    <div class="r">Nehemiah 8:10 · neither be ye sorry</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Heb. 12:1</strong> — “Let us run with patience the race that is set before us.”<br>
    <strong>Isa. 40:31</strong> — “They shall run, and not be weary; and they shall walk,
    and not faint.”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>Register and pay for the marathon now</b> — the entry fee is the commitment device.</li>
    <li><b>Sixteen weeks out,</b> the training plan goes in the calendar as appointments,
        not intentions. Long run every Saturday.</li>
    <li><b>Six weeks before your birthday,</b> the date, the place and the invitations
        are sent. You do not get celebrated by accident.</li>
    <li><b>By 1 November,</b> the Remember December plan is made — who, where, what you
        are giving.</li>
  </ul>

  <div class="foot"><span>A time to dance</span><span>Sheet C8</span></div>
""")


C9 = card(sheet="C9", inner="""
  <div class="eyebrow">People · 2026</div>
  <div class="script" style="font-size:19mm;margin:4mm 0 1mm">Relationships</div>
  <div class="h-mod" style="font-size:3.4mm;color:var(--cocoa);margin-bottom:5mm">Build your circle</div>

  <div class="scripture">
    <span class="ref">Proverbs 27:17 · Proverbs 13:20</span>
    <div class="verse">“<em>Iron sharpeneth iron</em>; so a man sharpeneth the countenance of
      his friend.”<br>“He that walketh with wise men shall be wise: but a companion of fools
      shall be destroyed.”</div>
  </div>

  <div class="block-label" style="margin:6mm 0 3.5mm">The Vision</div>
  <ul class="vision">
    <li>A circle chosen <strong>on purpose</strong> — not inherited by proximity.</li>
    <li>People who are <strong>ahead of me</strong> in something and unafraid to say so.</li>
    <li>People I am <strong>faithfully carrying</strong> — I am someone’s answered prayer too.</li>
  </ul>

  <div style="border:.4mm solid var(--almond);padding:5mm;margin:2mm 0 5mm">
    <div style="font-size:2.4mm;font-weight:700;letter-spacing:.3em;color:var(--terracotta);
      text-transform:uppercase;margin-bottom:3.5mm">The five names</div>
    <div style="display:flex;flex-direction:column;gap:5mm">
      <div style="border-bottom:.3mm dashed var(--stone);height:7mm"></div>
      <div style="border-bottom:.3mm dashed var(--stone);height:7mm"></div>
      <div style="border-bottom:.3mm dashed var(--stone);height:7mm"></div>
      <div style="border-bottom:.3mm dashed var(--stone);height:7mm"></div>
      <div style="border-bottom:.3mm dashed var(--stone);height:7mm"></div>
    </div>
    <div style="font-size:2.4mm;color:var(--stone);margin-top:3.5mm;letter-spacing:.06em">
      Write them in by hand. A circle you can’t name is a circle you don’t have.</div>
  </div>

  <div class="grow"></div>

  <div class="pull">
    <div class="q">A friend loveth at all times</div>
    <div class="r">Proverbs 17:17 · born for adversity</div>
  </div>

  <div class="grow"></div>

  <div class="verse-mini" style="margin-bottom:4mm">
    <b>Standing on</b><br>
    <span style="display:block;margin-top:1.5mm">
    <strong>Eccl. 4:9–10</strong> — “Two are better than one… for if they fall, the one will
    lift up his fellow.”<br>
    <strong>Amos 3:3</strong> — “Can two walk together, except they be agreed?”</span>
  </div>

  <div class="block-label" style="margin-bottom:3.5mm">Actionables</div>
  <ul class="acts">
    <li><b>One intentional conversation a week</b> — not a text, a conversation.</li>
    <li><b>One gathering a month that I host.</b> Be the one who makes the table, not the
        one who waits for an invitation.</li>
    <li><b>If someone comes to mind,</b> then reach out the same day. That prompting is
        usually not random.</li>
    <li><b>Ask for help out loud</b> at least once a month. Isolation is the enemy’s
        cheapest strategy.</li>
  </ul>

  <div class="foot"><span>Iron sharpeneth iron</span><span>Sheet C9</span></div>
""")


C10 = card(sheet="C10", inner="""
  <div class="eyebrow">How this board works</div>
  <div class="script" style="font-size:20mm;margin:4mm 0 1mm">The Rhythm</div>
  <div class="h-mod" style="font-size:3mm;color:var(--cocoa);margin-bottom:5mm">
    What the research says makes a vision actually happen</div>

  <div class="scripture">
    <span class="ref">Habakkuk 2:2–3</span>
    <div class="verse">“<em>Write the vision, and make it plain upon tables, that he may run
      that readeth it.</em> For the vision is yet for an appointed time… though it tarry,
      wait for it; because it will surely come.”</div>
  </div>

  <div class="block-label" style="margin:5.5mm 0 3.5mm">Six findings this board is built on</div>
  <ul class="acts" style="margin-bottom:4mm">
    <li><b>Write it, don’t wish it.</b> Matthews (Dominican University) — people who wrote
        their goals, wrote action commitments and sent weekly progress to a friend achieved
        about 76%, versus 43% for those who only thought about them.</li>
    <li><b>Picture the process, not just the prize.</b> Pham &amp; Taylor (UCLA, 1999) —
        students who mentally rehearsed the <i>studying</i> scored higher; those who only
        pictured the good grade studied less.</li>
    <li><b>Contrast the wish with the obstacle.</b> Oettingen’s WOOP — Wish, Outcome,
        Obstacle, Plan. Fantasy alone predicts <i>less</i> achievement.</li>
    <li><b>“If–then” beats good intentions.</b> Gollwitzer &amp; Sheeran, 94 studies —
        naming when and where you will act is one of the strongest effects in the literature.</li>
    <li><b>Specific and hard beats “do your best.”</b> Locke &amp; Latham’s goal-setting
        theory — vague goals produce vague effort.</li>
    <li><b>Look daily; the eye recruits attention.</b> A goal you see is a goal your mind
        keeps solving in the background.</li>
  </ul>

  <div class="grow"></div>

  <div class="block-label" style="margin-bottom:3.5mm">The cadence</div>
  <ul class="acts">
    <li><b>Daily · 60 seconds.</b> Read the headline out loud. Name one thing today that
        serves it.</li>
    <li><b>Weekly · Sunday 18:00.</b> Ten minutes at the board. What moved, what didn’t,
        what is next — then send it to one person who will ask you about it.</li>
    <li><b>Monthly.</b> The numbers: cashflow, savings, investments, gym sessions,
        membership.</li>
    <li><b>Quarterly.</b> Re-read the Dream of CRC. Adjust the plan, never the purpose.</li>
  </ul>

  <div class="declare" style="margin-top:4mm">
    <div class="big" style="font-size:3.2mm">Commit thy works unto the LORD,<br>
      and thy thoughts shall be established</div>
    <div class="small">Proverbs 16:3</div>
  </div>

  <div class="foot"><span>Make it plain · run with it</span><span>Sheet C10</span></div>
""")


CARDS = [C1, C2, C3, CRC_A, CRC_B, C6, C7, C8, C9, C10]


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
/* the seam between banner sheets, shown faintly so the paste-up is obvious */
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
