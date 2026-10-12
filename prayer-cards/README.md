# Prayer cards

Cut-out cards, **8 to an A4 sheet**. One page, all eight written.

![Page one](preview/cards-p1.png)

---

## What's here

| File | What it is |
|---|---|
| `print/prayer-cards-A4.pdf` | The page, print-ready — A4 portrait |
| `cards.html` | The same page on screen |
| `print.html` | The print stylesheet version |
| `preview/cards-p1.png` | The page |
| `build.py` | The cards themselves live here — edit and rebuild |
| `render.mjs` | Re-renders the previews and the PDF, and checks no card overflows its cut line |

## Printing and cutting

A4 portrait, **100% / "Actual size"**, backgrounds **on**.

**200–250 gsm card stock** if you want these to survive being carried around;
ordinary paper works if they're going on a mirror or in a Bible.

Cards are **95 × 67.25 mm** with a hairline border to cut along, and there are
4 mm gutters between them, so this prints on any printer — no borderless, no
bleed. Cut down the gutters with a guillotine or straight down the border lines
with scissors.

---

## What's on a card

Four parts, in this order, because the order is the point:

| Block | What goes in it |
|---|---|
| **Request** | The specific thing, in one line. Not "bless my work" — a number and a date. |
| **Scripture** | The verse that holds the faith up while you wait. NLT throughout. |
| **I have received it** | The prayer, in the **past tense**, with a date and time to write in. |
| **Praise** | Thanks given for it as though it is already done. |

The third block carries **Mark 11:24** on every card — *"you can pray for
anything, and if you believe that you've received it, it will be yours."* That's
why it is written as a thing already had rather than a thing still wanted, and
why there is somewhere to write the date and time you prayed it. Every card is
dated **by 30 October**.

### The eight cards

| Card | What it carries |
|---|---|
| **Finances** | R80 000 in, twenty percent tithed — R16 000 given first. Malachi 3:10 |
| **Innaderm · $10K days** | $3 000 days to $10 000 days. Deuteronomy 1:11 |
| **Disputes under 1%** | Down from 0.9%, never a hold on the account. Psalm 121:7 |
| **Customer support** | The right tool, tickets categorised, response times down. Philippians 2:4 |
| **Stock & fulfilment** | The dashboard, 30-day needs, lead times 22 days → 10. Proverbs 27:23 |
| **The pre-order button** | Live and tested, so a stockout costs nothing. Proverbs 27:12 |
| **The systems** | ClickUp → AdNova, the SOPs, delegated access. Habakkuk 2:2 |
| **Serentia · $100K days** | The trigger the $5 000 bonus was tied to. Proverbs 14:23 |

Six of the eight come straight out of the **12 October call with Calvin** — the
numbers, the thresholds and the pieces of work are his, not invented here. They
also chain: the systems and the dashboards are the value, the value drops the
dispute rate and earns the bonus.

`BLANKS` is 0 because eight written cards fill the page exactly. Set it to 8 for
a second page of ruled blanks.

---

## Editing

The cards are a list of dicts at the top of `build.py`. Add, remove or
reword, then:

```bash
python3 build.py                        # rewrites cards.html and print.html
npm i playwright && node render.mjs     # refreshes preview/ and print/
```

`BLANKS` sets how many ruled cards are added at the end; the build pads to whole
pages of eight.

**Keep the lines short.** A card is 95 mm wide and fixed height — `render.mjs`
fails loudly and names any card whose text overruns its cut line, so run it after
every edit rather than trusting the HTML to look fine.
