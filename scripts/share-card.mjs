import { readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.IMD_PLAYWRIGHT || 'playwright');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  const silkscreen = (await readFile('assets/fonts/silkscreen.woff2')).toString('base64');
  const vt323 = (await readFile('assets/fonts/vt323.woff2')).toString('base64');
  await page.setContent(`<style>@font-face{font-family:Silkscreen;src:url(data:font/woff2;base64,${silkscreen})}@font-face{font-family:VT323;src:url(data:font/woff2;base64,${vt323})}body{margin:0}canvas{display:block}</style><canvas width="1200" height="630"></canvas>`);
  await page.evaluate(async () => { await document.fonts.load('32px Silkscreen'); await document.fonts.load('32px VT323'); });
  await page.addScriptTag({ content: (await readFile('src/art.js', 'utf8')).replaceAll('export function', 'function') });
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas'), ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1c211b'; ctx.fillRect(0, 0, 1200, 630); ctx.imageSmoothingEnabled = false;
    ctx.strokeStyle = '#454b38'; ctx.strokeRect(32, 32, 1136, 566);
    const scene = document.createElement('canvas'); scene.width = 280; scene.height = 220;
    drawWheelScene(scene.getContext('2d'), true, 0.5);
    ctx.drawImage(scene, 630, 90, 504, 396);
    ctx.font = '40px Silkscreen'; ctx.fillStyle = '#e7bd76'; ctx.fillText('Squeek', 76, 172);
    ctx.fillStyle = '#b2cb83'; ctx.fillText('Sprouts', 76, 228);
    ctx.font = '32px VT323'; ctx.fillStyle = '#e4ddc7';
    ctx.fillText('One hamster. Nine little plots.', 78, 294);
    ctx.font = '26px VT323'; ctx.fillStyle = '#b0b09a';
    ctx.fillText('A tiny garden grown by real wheel work.', 78, 335);
    ['radish', 'carrot', 'pumpkin', 'sunflower', 'melon'].forEach((id, i) => { ctx.save(); ctx.translate(76 + i * 94, 380); ctx.scale(2.1, 2.1); cropSprite(ctx, id, 3); ctx.restore(); });
    ctx.fillStyle = '#454b38'; ctx.fillRect(76, 520, 1056, 1);
    ctx.font = '24px VT323'; ctx.fillStyle = '#b0b09a';
    ctx.fillText('Powered by Squeektoshi. Made for Squeekchain.', 76, 558);
    ctx.fillStyle = '#e7bd76'; ctx.fillText('Plant a little possibility.', 829, 558);
  });
  const data = await page.evaluate(() => document.querySelector('canvas').toDataURL('image/png').split(',')[1]);
  await writeFile('assets/share.png', Buffer.from(data, 'base64'));
  console.log('Created assets/share.png at 1200 × 630 using the game’s canvas artwork.');
} finally { await browser.close(); }
