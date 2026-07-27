// Renders the preview PNG and the two print PDFs from the built HTML, and
// audits every sheet for overflow (cards are fixed at exactly A4 and clip).
//
//   npm i playwright        # once, anywhere on the machine
//   node render.mjs
//
// Reads board.html / print-banner.html / print-cards.html; writes preview/ and print/.
import { chromium } from 'playwright';
const DIR = new URL(".", import.meta.url).pathname.replace(/\/$/, "");
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const audit = async (page) => page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('.card,.tile')) {
    const stack = el.querySelector('.stack') || el;
    const over = stack.scrollHeight - stack.clientHeight;
    const top = stack.getBoundingClientRect().top;
    let bottom = 0;
    for (const kid of stack.querySelectorAll('*')) {
      const r = kid.getBoundingClientRect();
      if (kid.closest('.foot') || kid.classList.contains('grow')) continue;
      if (r.height > 0)
        bottom = Math.max(bottom, r.bottom - top);
    }
    out.push({ sheet: el.dataset.sheet, over, fill: +(bottom / stack.clientHeight).toFixed(2) });
  }
  return out;
});

const p = await b.newPage({ viewport: { width: 4492, height: 3178 }, deviceScaleFactor: 1 });
await p.goto('file://' + DIR + '/board.html');
await p.waitForTimeout(2500);
const a = await audit(p);
const bad = a.filter(x => x.over > 1);
console.log(bad.length ? 'OVERFLOW >> ' + JSON.stringify(bad) : 'overflow: all ' + a.length + ' sheets fit');
console.log('fill: ' + a.map(x => `${x.sheet}=${x.fill}`).join('  '));
await (await p.$('.a0')).screenshot({ path: DIR + '/preview/board-A0.png' });
for (const sel of ['C1','C2','C3','C4','C5','C6','C7','C8','C9','C10','B1','B2','B3','B4']) {
  const el = await p.$(`[data-sheet="${sel}"]`);
  if (el) await el.screenshot({ path: `${DIR}/preview/sheets/${sel}.png` });
}
console.log('previews ok');

const p2 = await b.newPage();
await p2.goto('file://' + DIR + '/print-banner.html'); await p2.waitForTimeout(1500);
await p2.pdf({ path: DIR + '/print/01-headline-A4-landscape.pdf', format: 'A4', landscape: true,
               printBackground: true, margin: {top:0,right:0,bottom:0,left:0} });
await p2.goto('file://' + DIR + '/print-cards.html'); await p2.waitForTimeout(1500);
await p2.pdf({ path: DIR + '/print/02-cards-A4-portrait.pdf', format: 'A4', landscape: false,
               printBackground: true, margin: {top:0,right:0,bottom:0,left:0} });
console.log('pdfs ok');
await b.close();
