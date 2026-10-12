// Renders the preview PNGs and the print-ready PDF, and checks no card's text
// overflows its cut line (cards are fixed size and clip).
//
//   npm i playwright        # once, anywhere on the machine
//   node render.mjs
import { chromium } from 'playwright';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto('file://' + DIR + '/cards.html');
await p.waitForTimeout(1800);
const bad = await p.evaluate(() => {
  const out = [];
  document.querySelectorAll('.card').forEach((el, i) => {
    const over = el.scrollHeight - el.clientHeight;
    if (over > 1) out.push({ i, title: el.querySelector('.t')?.textContent.trim(), over });
  });
  return out;
});
const pages = await p.$$('.page');
console.log(bad.length ? 'OVERFLOW >> ' + JSON.stringify(bad)
  : `fits · ${pages.length} page(s) · ${(await p.$$('.card')).length} cards`);
for (let i = 0; i < pages.length; i++)
  await pages[i].screenshot({ path: `${DIR}/preview/cards-p${i + 1}.png` });

const p2 = await b.newPage();
await p2.goto('file://' + DIR + '/print.html');
await p2.waitForTimeout(1500);
await p2.pdf({ path: DIR + '/print/prayer-cards-A4.pdf', format: 'A4',
               printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
console.log('pdf ok');
await b.close();
