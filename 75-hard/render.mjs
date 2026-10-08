// Renders the A3 preview PNG and the print-ready PDF, and checks the sheet
// does not overflow (it is fixed at exactly A3 landscape and clips).
//
//   npm i playwright        # once, anywhere on the machine
//   node render.mjs
import { chromium } from 'playwright';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const p = await b.newPage({ viewport: { width: 1588, height: 1123 } });
await p.goto('file://' + DIR + '/tracker.html');
await p.waitForTimeout(2000);
const fit = await p.evaluate(() => {
  const s = document.querySelector('.sheet');
  return { overY: s.scrollHeight - s.clientHeight, overX: s.scrollWidth - s.clientWidth,
           blocks: document.querySelectorAll('.block').length,
           rows: document.querySelectorAll('.row').length,
           boxes: document.querySelectorAll('.box').length };
});
console.log(fit.overY > 1 || fit.overX > 1
  ? `OVERFLOW >> ${JSON.stringify(fit)}`
  : `fits · ${fit.blocks} blocks · ${fit.rows} day rows · ${fit.boxes} tick boxes`);
await (await p.$('.sheet')).screenshot({ path: DIR + '/preview/tracker-A3.png' });

const p2 = await b.newPage();
await p2.goto('file://' + DIR + '/print.html');
await p2.waitForTimeout(1500);
await p2.pdf({ path: DIR + '/print/75-hard-A3-landscape.pdf', format: 'A3', landscape: true,
               printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
console.log('pdf ok');
await b.close();
