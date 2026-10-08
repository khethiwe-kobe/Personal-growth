// Renders the A3 preview PNG and the print-ready PDF, and checks the sheet
// does not overflow (it is fixed at exactly A3 portrait and clips).
//
//   npm i playwright        # once, anywhere on the machine
//   node render.mjs
import { chromium } from 'playwright';
const DIR = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });

const p = await b.newPage({ viewport: { width: 1123, height: 1588 } });
await p.goto('file://' + DIR + '/wall.html');
await p.waitForTimeout(2500);
const fit = await p.evaluate(() => {
  const s = document.querySelector('.sheet');
  const shots = [...document.querySelectorAll('.ph img')].map(i => ({
    nat: +(i.naturalWidth / i.naturalHeight).toFixed(2),
    box: +(i.clientWidth / i.clientHeight).toFixed(2),
    dpi: Math.round(i.naturalWidth / (i.clientWidth / 96)),
  }));
  return { overY: s.scrollHeight - s.clientHeight, overX: s.scrollWidth - s.clientWidth, shots };
});
console.log(fit.overY > 1 || fit.overX > 1
  ? `OVERFLOW >> y${fit.overY} x${fit.overX}`
  : `fits · ${fit.shots.length} pictures`);
// how much of each picture the frame throws away, and what it prints at
for (const s of fit.shots) {
  const lost = Math.round((1 - Math.min(s.nat, s.box) / Math.max(s.nat, s.box)) * 100);
  console.log(`   native ${s.nat}  frame ${s.box}  cropped ${lost}%  ~${s.dpi} dpi`);
}
await (await p.$('.sheet')).screenshot({ path: DIR + '/preview/wall-A3.png' });

const p2 = await b.newPage();
await p2.goto('file://' + DIR + '/print.html');
await p2.waitForTimeout(2000);
await p2.pdf({ path: DIR + '/print/vision-wall-A3-portrait.pdf', format: 'A3',
               printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
console.log('pdf ok');
await b.close();
