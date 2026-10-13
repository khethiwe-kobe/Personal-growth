// Renders the previews and the two print PDFs, and checks that no card's text
// overflows its cut line (cards are fixed size and clip).
//
//   npm i playwright        # once, anywhere on the machine
//   node render.mjs
import { chromium } from 'playwright';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const check = async (file, sel, label) => {
  const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
  await p.goto('file://' + DIR + '/' + file);
  await p.waitForTimeout(1600);
  const bad = await p.evaluate((s) => {
    const out = [];
    document.querySelectorAll(s).forEach((el, i) => {
      const over = el.scrollHeight - el.clientHeight;
      if (over > 1) out.push({ i, topic: el.querySelector('.topic,.t')?.textContent.trim(), over });
    });
    return out;
  }, sel);
  const pages = await p.$$('.page');
  console.log(bad.length ? `OVERFLOW (${label}) >> ` + JSON.stringify(bad)
    : `${label}: fits · ${pages.length} page(s) · ${(await p.$$(sel)).length} cards`);
  for (let i = 0; i < pages.length; i++)
    await pages[i].screenshot({ path: `${DIR}/preview/${label}-p${i + 1}.png` });
  await p.close();
};

await check('cards.html', '.card', 'cards');
await check('titles.html', '.tcard', 'titles');

for (const [src, out] of [['print-cards.html', 'scripture-cards-A4.pdf'],
                          ['print-titles.html', 'topic-titles-A4.pdf']]) {
  const p = await b.newPage();
  await p.goto('file://' + DIR + '/' + src);
  await p.waitForTimeout(1400);
  await p.pdf({ path: `${DIR}/print/${out}`, format: 'A4', printBackground: true,
                margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await p.close();
}
console.log('pdfs ok');
await b.close();
