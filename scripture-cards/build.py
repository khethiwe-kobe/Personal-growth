#!/usr/bin/env python3
"""
SCRIPTURE CARDS — scripture and declaration, 8 to an A4 sheet.

Six topics, four scriptures each: 24 cards over three pages, plus a separate
page of six title cards to pin above each group on the wall.

Every card carries its topic title, so a card that comes loose still knows
where it belongs. Scripture is NLT throughout. Each verse is paired with a
declaration written in the first person and the present tense — the verse is
what God said, the declaration is it spoken back.

Layout
------
Cards   A4 portrait, 8 mm margin, 2 x 4 at 95 x 67.25 mm, 4 mm gutters.
Titles  A4 portrait, 2 x 3 at 95 x 91 mm — bigger, to read from across a room.

Both have gutters, so they print on any printer and cut with scissors.

Run:  python3 build.py
"""

import base64
import pathlib

HERE = pathlib.Path(__file__).parent
FONTS = HERE.parent / "vision-board" / "fonts"


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
# The six topics. Four verses each, so the deck comes to three full pages.
# --------------------------------------------------------------------------

TOPICS = [
    dict(
        title="Wisdom at Work",
        sub="The diligent hand · the self-governed worker",
        verses=[
            dict(
                text="“Take a lesson from the ants… Though they have no prince or governor "
                     "or ruler to make them work, they labour hard all summer.”",
                ref="Proverbs 6:6–8 NLT",
                declare="I do not need to be watched to work. I manage myself, and I "
                        "finish what I start.",
            ),
            dict(
                text="“Do you see any truly competent workers? They will serve kings "
                     "rather than ordinary people.”",
                ref="Proverbs 22:29 NLT",
                declare="I am excellent at what I do, and my work puts me in front of "
                        "people of influence.",
            ),
            dict(
                text="“Work willingly at whatever you do, as though you were working for "
                     "the Lord rather than for people.”",
                ref="Colossians 3:23 NLT",
                declare="I work for God, not for a man. My reward comes from Him.",
            ),
            dict(
                text="“If you need wisdom, ask our generous God, and he will give it to "
                     "you. He will not rebuke you for asking.”",
                ref="James 1:5 NLT",
                declare="I ask God for wisdom and I receive it. I am not guessing in "
                        "my work.",
            ),
        ],
    ),
    dict(
        title="Financial Wisdom",
        sub="Increase · discipline · the storehouse",
        verses=[
            dict(
                text="“Remember the LORD your God. He is the one who gives you power to "
                     "be successful, in order to fulfil the covenant he confirmed.”",
                ref="Deuteronomy 8:18 NLT",
                declare="God gives me power to create wealth, and I use it to build "
                        "His kingdom.",
            ),
            dict(
                text="“The wise have wealth and luxury, but fools spend whatever "
                     "they get.”",
                ref="Proverbs 21:20 NLT",
                declare="I keep a store. I do not spend everything I am given.",
            ),
            dict(
                text="“Wealth from get-rich-quick schemes quickly disappears; wealth from "
                     "hard work grows over time.”",
                ref="Proverbs 13:11 NLT",
                declare="My increase is built, not gambled. It grows, and it stays.",
            ),
            dict(
                text="“If you are faithful in little things, you will be faithful in "
                     "large ones.”",
                ref="Luke 16:10 NLT",
                declare="I am faithful with small amounts, so I am trusted with "
                        "large ones.",
            ),
        ],
    ),
    dict(
        title="Discipline",
        sub="Self-governed · trained · standing walls",
        verses=[
            dict(
                text="“I discipline my body like an athlete, training it to do what "
                     "it should.”",
                ref="1 Corinthians 9:27 NLT",
                declare="I train my body to do what it should. My feelings do not run "
                        "my day.",
            ),
            dict(
                text="“No discipline is enjoyable while it is happening… But afterward "
                     "there will be a peaceful harvest of right living.”",
                ref="Hebrews 12:11 NLT",
                declare="I accept the hard part now for the harvest later.",
            ),
            dict(
                text="“A person without self-control is like a city with broken-down "
                     "walls.”",
                ref="Proverbs 25:28 NLT",
                declare="My walls are standing. I govern myself.",
            ),
            dict(
                text="“For God has not given us a spirit of fear and timidity, but of "
                     "power, love, and self-discipline.”",
                ref="2 Timothy 1:7 NLT",
                declare="God gave me power, love and self-discipline. Fear is not "
                        "from Him.",
            ),
        ],
    ),
    dict(
        title="Leader and Disciple",
        sub="Led before leading · the towel before the title",
        verses=[
            dict(
                text="“Whoever wants to be a leader among you must be your servant, and "
                     "whoever wants to be first must be the slave of everyone else.”",
                ref="Mark 10:43–44 NLT",
                declare="I lead by serving. The towel comes before the title.",
            ),
            dict(
                text="“Students are not greater than their teacher. But the student who "
                     "is fully trained will become like the teacher.”",
                ref="Luke 6:40 NLT",
                declare="I am being fully trained, and I will look like my Teacher.",
            ),
            dict(
                text="“Be an example to all believers in what you say, in the way you "
                     "live, in your love, your faith, and your purity.”",
                ref="1 Timothy 4:12 NLT",
                declare="My age is not a limit. I am an example in speech, in life, in "
                        "love and in faith.",
            ),
            dict(
                text="“You are truly my disciples if you remain faithful to my "
                     "teachings.”",
                ref="John 8:31 NLT",
                declare="I remain in His word. That is what makes me a disciple and not "
                        "an admirer.",
            ),
        ],
    ),
    dict(
        title="My Father, My Source",
        sub="Not a servant at the door · a child at the table",
        verses=[
            dict(
                text="“The LORD is my shepherd; I have all that I need.”",
                ref="Psalm 23:1 NLT",
                declare="The Lord is my shepherd. I have all that I need.",
            ),
            dict(
                text="“So if you sinful people know how to give good gifts to your "
                     "children, how much more will your heavenly Father give good gifts "
                     "to those who ask him.”",
                ref="Matthew 7:11 NLT",
                declare="My Father gives good gifts. I ask Him boldly and without "
                        "apology.",
            ),
            dict(
                text="“Whatever is good and perfect is a gift coming down to us from God "
                     "our Father, who created all the lights in the heavens.”",
                ref="James 1:17 NLT",
                declare="Every good thing I have came down from my Father. Nothing good "
                        "in my life is an accident.",
            ),
            dict(
                text="“You received God’s Spirit when he adopted you as his own children. "
                     "Now we call him, ‘Abba, Father.’”",
                ref="Romans 8:15 NLT",
                declare="I am not a servant begging at the door. I am His child, and I "
                        "call Him Abba.",
            ),
        ],
    ),
    dict(
        title="Protection",
        sub="Kept · covered · no weapon succeeds",
        verses=[
            dict(
                text="“Those who live in the shelter of the Most High will find rest in "
                     "the shadow of the Almighty. He alone is my refuge, my place "
                     "of safety.”",
                ref="Psalm 91:1–2 NLT",
                declare="I live in the shelter of the Most High. He is my refuge and my "
                        "place of safety.",
            ),
            dict(
                text="“The LORD keeps you from all harm and watches over your life. The "
                     "LORD keeps watch over you as you come and go.”",
                ref="Psalm 121:7–8 NLT",
                declare="The Lord watches over my coming and my going. I am kept.",
            ),
            dict(
                text="“No weapon turned against you will succeed. You will silence every "
                     "voice raised up to accuse you.”",
                ref="Isaiah 54:17 NLT",
                declare="No weapon formed against me will succeed. Every accusing voice "
                        "is silenced.",
            ),
            dict(
                text="“The name of the LORD is a strong fortress; the godly run to him "
                     "and are safe.”",
                ref="Proverbs 18:10 NLT",
                declare="I run to His name and I am safe. It is a strong tower and "
                        "it holds.",
            ),
        ],
    ),
]


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
      display:grid;gap:4mm;overflow:hidden;}
.page.cards{grid-template-columns:repeat(2,95mm);grid-template-rows:repeat(4,67.25mm);}
.page.titles{grid-template-columns:repeat(2,95mm);grid-template-rows:repeat(3,91mm);}

/* ---------------------------------------------------- scripture card ---- */
.card{position:relative;overflow:hidden;background:var(--linen);
      border:.3mm solid var(--almond);padding:3.6mm 4.2mm;
      display:flex;flex-direction:column;}
.card .topic{font-size:1.9mm;font-weight:800;letter-spacing:.26em;text-transform:uppercase;
             color:var(--terracotta);padding-bottom:1.6mm;
             border-bottom:.3mm solid var(--almond);margin-bottom:2.8mm;}
.card .body{flex:1;display:flex;flex-direction:column;justify-content:center;
            padding:1mm 0 2.4mm;}
.card .v{font-size:3.6mm;line-height:1.44;color:var(--umber);font-weight:400;}
.card .r{font-size:2mm;font-weight:800;letter-spacing:.16em;text-transform:uppercase;
         color:var(--cocoa);margin-top:2.8mm;}
.card .dec{background:var(--sand);margin-left:-2mm;margin-right:-2mm;
           padding:2.4mm 2mm 2.6mm;}
.card .dec .k{font-size:1.75mm;font-weight:800;letter-spacing:.24em;text-transform:uppercase;
              color:var(--terracotta);margin-bottom:1mm;}
.card .dec .d{font-size:2.7mm;line-height:1.4;font-weight:700;color:var(--espresso);}

/* ------------------------------------------------------- title card ---- */
.tcard{position:relative;overflow:hidden;background:var(--espresso);color:var(--linen);
       border:.3mm solid var(--espresso);padding:8mm 7mm;
       display:flex;flex-direction:column;justify-content:center;text-align:center;}
.tcard .n{font-size:2.1mm;font-weight:800;letter-spacing:.34em;color:var(--terracotta);}
.tcard .t{font-family:'Mairo',cursive;font-size:15mm;line-height:1.14;color:var(--linen);
          margin:5mm 0 1mm;}
.tcard .bar{width:22mm;height:.7mm;background:var(--terracotta);margin:4mm auto;}
.tcard .s{font-size:2.3mm;font-weight:600;letter-spacing:.2em;text-transform:uppercase;
          color:var(--almond);line-height:1.6;}
.tcard .c{font-size:1.9mm;font-weight:800;letter-spacing:.26em;text-transform:uppercase;
          color:var(--stone);margin-top:5mm;}
"""

PAGE_HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>{title}</title><style>{fonts}{css}{extra}</style></head><body>{body}</body></html>
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


def card_html(topic, v):
    return f"""
<div class="card">
  <div class="topic">{topic}</div>
  <div class="body"><div class="v">{v['text']}</div><div class="r">{v['ref']}</div></div>
  <div class="dec"><div class="k">I declare</div><div class="d">{v['declare']}</div></div>
</div>"""


def title_html(i, t):
    n = len(t["verses"])
    return f"""
<div class="tcard">
  <div class="n">{i:02d}</div>
  <div class="t">{t['title']}</div>
  <div class="bar"></div>
  <div class="s">{t['sub']}</div>
  <div class="c">{n} scriptures</div>
</div>"""


def write(name, title, body, extra):
    html = PAGE_HTML.format(title=title, fonts=font_css(), css=CSS,
                            extra=extra, body=body)
    (HERE / name).write_text(html, encoding="utf-8")
    print(f"  {name}  ({len(html)/1024:.0f} kB)")


def main():
    cells = [card_html(t["title"], v) for t in TOPICS for v in t["verses"]]
    pages = [cells[i:i + 8] for i in range(0, len(cells), 8)]
    cards_body = "".join(f'<div class="page cards">{"".join(p)}</div>' for p in pages)

    titles = [title_html(i + 1, t) for i, t in enumerate(TOPICS)]
    tpages = [titles[i:i + 6] for i in range(0, len(titles), 6)]
    titles_body = "".join(f'<div class="page titles">{"".join(p)}</div>' for p in tpages)

    write("cards.html", "Scripture cards", cards_body, SCREEN_CSS)
    write("print-cards.html", "Scripture cards — print", cards_body, PRINT_CSS)
    write("titles.html", "Topic titles", titles_body, SCREEN_CSS)
    write("print-titles.html", "Topic titles — print", titles_body, PRINT_CSS)

    print(f"  {len(TOPICS)} topics · {len(cells)} cards on {len(pages)} page(s) "
          f"· titles on {len(tpages)} page(s)")


if __name__ == "__main__":
    print("building…")
    main()
    print("done.")
