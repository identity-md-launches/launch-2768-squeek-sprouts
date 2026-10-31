import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { staticServer } from '../scripts/server.mjs';
import { newGarden, applyWheel } from '../src/engine.js';

const playwright = await import(process.env.IMD_PLAYWRIGHT || 'playwright');
const { default: AxeBuilder } = await import(process.env.IMD_AXE || '@axe-core/playwright');
const output = 'test/scratch/browser-tests';
await mkdir(output, { recursive: true });
const server = staticServer();
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
const results = [];
const limitations = [];

function status(work = 1000, { running = false, freshness = 'online', epoch = 'browser-test' } = {}) {
  return { measurement: { cumulativeWorkUnits: String(work), counterEpoch: epoch, freshness, coreStatus: running ? 'SPINNING' : 'IDLE', rpmMilli: running ? 128000 : 0, speedMmPerSecond: running ? 420 : 0, distanceMm: 1500000 }, builder: { projected: { blockHeight: '100' } } };
}
async function eventually(check, message) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(resolve => setTimeout(resolve, 25)); }
  throw new Error(message);
}
async function check(name, fn) {
  await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`);
}
async function saved(page, mode = 'live') { return page.evaluate(mode => JSON.parse(localStorage.getItem(`squeek-sprouts:v1:${mode}`)), mode); }

async function suite(browserType, name) {
  let browser;
  try { browser = await browserType.launch({ headless: true }); }
  catch (error) { if (name === 'chromium') throw error; limitations.push(`${name} could not launch: ${error.message.split('\n').slice(0, 8).join(' ')}`); console.log(`LIMITATION ${name}: missing browser host libraries`); return; }
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); const errors = [], badResources = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.url().startsWith(url) && r.status() >= 400) badResources.push(r.url()); });
    await page.clock.install({ time: new Date('2026-10-31T12:00:00Z') });
    let payload = status(), requestCount = 0, fail = false;
    await page.route('https://api.squeekchain.com/v1/status', route => { requestCount++; return fail ? route.abort('failed') : route.fulfill({ json: payload }); });
    await page.goto(url); await page.locator('#status-text').filter({ hasText: 'Napping' }).waitFor();
    const tick = async () => { const before = requestCount; await page.clock.fastForward(15001); await eventually(() => requestCount > before, '15 second poll did not run'); await page.waitForTimeout(60); };

    await check(`${name}: subpath export, local fonts, 390px first-screen primary action`, async () => {
      assert.match(await page.title(), /Squeek Sprouts/); assert.equal(await page.locator('.plot').count(), 9);
      const first = await page.locator('[data-plot="0"]').boundingBox(); assert.ok(first.y + first.height < 844);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth), 390);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => [...document.fonts].every(font => font.status === 'loaded')), true);
      await page.screenshot({ path: `${output}/${name}-390-initial.png` });
    });
    await check(`${name}: plant and inspect using keyboard; nap does not grow crops`, async () => {
      await page.locator('[data-plot="0"]').focus(); await page.keyboard.press('Enter');
      assert.equal((await saved(page)).plots[0].crop, 'radish'); assert.match(await page.locator('[data-plot="0"]').innerText(), /0 \/ 40/);
      await tick(); assert.match(await page.locator('[data-plot="0"]').innerText(), /0 \/ 40/);
      await page.keyboard.press('Space'); assert.match(await page.locator('#feedback').innerText(), /40 wheel work left/);
      assert.match(await page.locator('[data-plot="0"]').innerText(), /40 work left/);
    });
    await check(`${name}: live work advances growth; stale signal pauses and disables fresh bonus`, async () => {
      payload = status(1015, { running: true }); await tick();
      assert.match(await page.locator('[data-plot="0"]').innerText(), /15 \/ 40/);
      payload = status(3000, { running: true, freshness: 'stale' }); await tick();
      assert.match(await page.locator('#status-text').innerText(), /Stale/); assert.match(await page.locator('[data-plot="0"]').innerText(), /15 \/ 40/);
      await page.locator('[data-plot="1"]').click(); assert.equal((await saved(page)).plots[1], null);
    });
    await check(`${name}: epoch restart preserves exact progress and logs the restart`, async () => {
      payload = status(3, { running: true, epoch: 'second-epoch' }); await tick();
      assert.equal((await saved(page)).plots[0].planted, '-12'); assert.match(await page.locator('[data-plot="0"]').innerText(), /15 \/ 40/);
      assert.match(await page.locator('#journal-list').innerText(), /counter restarted/);
    });
    await check(`${name}: ripe crop, golden harvest, seed unlock and paid planting`, async () => {
      payload = status(28, { running: true, epoch: 'second-epoch' }); await tick();
      assert.match(await page.locator('[data-plot="0"]').getAttribute('class'), /ripe/);
      await page.evaluate(() => { Math.random = () => .1; });
      await page.locator('[data-plot="0"]').click(); assert.equal((await saved(page)).crumbs, 70);
      assert.match(await page.locator('#feedback').innerText(), /Golden.*\+60/);
      assert.equal(await page.locator('[data-crop="carrot"]').getAttribute('class'), 'seed-button');
      await page.locator('[data-crop="carrot"]').click(); await page.locator('[data-plot="0"]').click();
      assert.equal((await saved(page)).plots[0].crop, 'carrot'); assert.equal((await saved(page)).crumbs, 62);
    });
    await check(`${name}: buy plot, reject out-of-order and unaffordable purchases`, async () => {
      await page.locator('[data-plot="5"]').click(); assert.equal((await saved(page)).openPlots, 3);
      await page.locator('[data-plot="3"]').click(); assert.equal((await saved(page)).openPlots, 4); assert.equal((await saved(page)).crumbs, 37);
      await page.locator('[data-plot="4"]').click(); assert.equal((await saved(page)).openPlots, 4); assert.match(await page.locator('#feedback').innerText(), /23 more/);
    });
    await check(`${name}: reload restores crops and catches up idle work`, async () => {
      payload = status(148, { epoch: 'second-epoch' }); await page.reload();
      await page.locator('[data-plot="0"].ripe').waitFor(); assert.equal((await saved(page)).selected, 'carrot');
      await page.locator('[data-plot="0"]').click(); assert.equal((await saved(page)).crumbs, 57); assert.equal((await saved(page)).earned, 80);
    });
    await check(`${name}: two failures enter labelled demo; switching preserves independent saves`, async () => {
      fail = true; await tick();
      await page.locator('#status-text').filter({ hasText: 'Stale' }).waitFor();
      assert.match(await page.locator('#status-text').innerText(), /Stale/);
      await tick(); await page.locator('#mode-notice').waitFor(); assert.match(await page.locator('#status-text').innerText(), /Demo/);
      assert.equal((await saved(page, 'demo')).crumbs, 10); await page.locator('[data-plot="0"]').click();
      assert.equal((await saved(page, 'demo')).plots[0].crop, 'radish');
      fail = false; await tick(); await page.locator('#return-live').click();
      assert.equal((await saved(page)).crumbs, 57); assert.equal((await saved(page)).plots[0], null);
      assert.equal(await page.locator('#mode-notice').isVisible(), false);
    });
    await check(`${name}: reset takes two activations, offers cancel, and only clears the active slot`, async () => {
      await page.locator('#reset-button').click(); assert.equal((await saved(page)).crumbs, 57);
      await page.locator('#reset-cancel').click(); assert.equal((await saved(page)).crumbs, 57);
      await page.locator('#reset-button').click(); await page.locator('#reset-button').click();
      const s = await saved(page); assert.equal(s.crumbs, 10); assert.equal(s.earned, 0); assert.equal(s.openPlots, 3); assert.ok(s.plots.every(p => p === null));
      assert.equal((await saved(page, 'demo')).plots[0].crop, 'radish');
    });
    await check(`${name}: help traps focus, Escape closes and restores focus`, async () => {
      await page.locator('#help-button').click(); assert.equal(await page.locator('#help-dialog').isVisible(), true);
      for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.closest('dialog') !== null), true); }
      await page.keyboard.press('Escape'); assert.equal(await page.locator('#help-dialog').isVisible(), false);
      assert.equal(await page.locator('#help-button').evaluate(el => el === document.activeElement), true);
    });
    await check(`${name}: reduced motion stops canvas animation, status still updates`, async () => {
      payload = status(150, { running: true, epoch: 'second-epoch' }); await tick();
      const before = await page.locator('#wheel-canvas').evaluate(c => c.toDataURL()); await page.clock.fastForward(300);
      assert.equal(await page.locator('#wheel-canvas').evaluate(c => c.toDataURL()), before);
      assert.match(await page.locator('#status-text').innerText(), /Running/);
    });
    await check(`${name}: running wheel animates and the pause control stops it`, async () => {
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.clock.runFor(100);
      const moving = await page.locator('#wheel-canvas').evaluate(c => c.toDataURL());
      await page.clock.runFor(300);
      assert.notEqual(await page.locator('#wheel-canvas').evaluate(c => c.toDataURL()), moving);
      await page.locator('#motion-button').click();
      const paused = await page.locator('#wheel-canvas').evaluate(c => c.toDataURL());
      await page.clock.runFor(300);
      assert.equal(await page.locator('#wheel-canvas').evaluate(c => c.toDataURL()), paused);
      await page.emulateMedia({ reducedMotion: 'reduce' });
    });
    await check(`${name}: no horizontal overflow at 320, 390, 760, 900 and 1440 pixels`, async () => {
      for (const width of [320, 390, 760, 900, 1440]) { await page.setViewportSize({ width, height: 900 }); await page.evaluate(() => scrollTo(0, 0)); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px overflow`); }
      await page.screenshot({ path: `${output}/${name}-1440-initial.png`, fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
    });
    await check(`${name}: 200% text enlargement retains every control without horizontal overflow`, async () => {
      await page.addStyleTag({ content: 'html{font-size:200%}' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({ path: `${output}/${name}-390-text-200.png`, fullPage: true });
      await page.reload(); await page.locator('#status-text').filter({ hasText: 'Running' }).waitFor();
    });
    await check(`${name}: automated WCAG 2.2 AA scan on garden and help`, async () => {
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      await writeFile(`${output}/${name}-axe-garden.json`, JSON.stringify(scan.violations, null, 2));
      assert.deepEqual(scan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
      await page.locator('#help-button').click();
      const helpScan = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      await writeFile(`${output}/${name}-axe-help.json`, JSON.stringify(helpScan.violations, null, 2));
      assert.deepEqual(helpScan.violations.map(v => ({ id: v.id, targets: v.nodes.map(n => n.target) })), []);
      await page.keyboard.press('Escape');
    });
    await check(`${name}: no script exceptions or missing local assets`, async () => { assert.deepEqual(errors, []); assert.deepEqual(badResources, []); });
    await context.close();

    await check(`${name}: all crop sprites and ripe states render at desktop and mobile widths`, async () => {
      const c = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1440, height: 1100 } });
      const p = await c.newPage();
      const s = newGarden(); s.crumbs = 2100; s.earned = 4000; s.openPlots = 9; s.lastWork = '10000'; s.epoch = 'visual-fixture';
      s.plots = [
        { crop: 'radish', planted: '10000', ripeLogged: false },
        { crop: 'carrot', planted: '9950', ripeLogged: false },
        { crop: 'pumpkin', planted: '9700', ripeLogged: false },
        { crop: 'sunflower', planted: '9000', ripeLogged: true },
        { crop: 'melon', planted: '7000', ripeLogged: true },
        { crop: 'radish', planted: '9960', ripeLogged: true },
        { crop: 'carrot', planted: '9880', ripeLogged: true },
        { crop: 'pumpkin', planted: '9600', ripeLogged: true },
        null,
      ];
      s.journal = [{ at: Date.now(), text: 'Visual test fixture: every crop, every growth stage.', kind: 'note' }];
      await p.addInitScript(state => localStorage.setItem('squeek-sprouts:v1:live', JSON.stringify(state)), s);
      await p.route('https://api.squeekchain.com/v1/status', route => route.fulfill({ json: status(10000, { running: true, epoch: 'visual-fixture' }) }));
      await p.goto(url); await p.locator('[data-plot="4"].ripe').waitFor();
      assert.equal(await p.locator('.plot.ripe').count(), 5);
      await p.screenshot({ path: `${output}/${name}-1440-crop-fixture.png`, fullPage: true });
      const scan = await new AxeBuilder({ page: p }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
      assert.deepEqual(scan.violations.map(v => v.id), []);
      await p.setViewportSize({ width: 390, height: 844 });
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await p.screenshot({ path: `${output}/${name}-390-crop-fixture.png`, fullPage: true });
      await c.close();
    });

    await check(`${name}: blocked localStorage is playable with an honest persistence warning`, async () => {
      const c = await browser.newContext(); const p = await c.newPage();
      await p.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Test storage denial', 'SecurityError'); } }); });
      await p.route('https://api.squeekchain.com/v1/status', route => route.fulfill({ json: status() }));
      await p.goto(url); await p.locator('#status-text').filter({ hasText: 'Napping' }).waitFor();
      assert.equal(await p.locator('#storage-warning').isVisible(), true); await p.locator('[data-plot="0"]').click();
      assert.match(await p.locator('[data-plot="0"]').innerText(), /0 \/ 40/); assert.match(await p.locator('#save-status').innerText(), /This visit only/); await c.close();
    });
    await check(`${name}: offline page loads all local assets and offers a playable demo`, async () => {
      const c = await browser.newContext(); const p = await c.newPage();
      await p.route('**/*', route => route.request().url().startsWith(url) ? route.continue() : route.abort());
      await p.goto(url); await p.locator('#demo-button').click();
      assert.match(await p.locator('#status-text').innerText(), /Demo/); await p.locator('[data-plot="0"]').click();
      assert.equal((await saved(p, 'demo')).plots[0].crop, 'radish'); await c.close();
    });
  } finally { await browser.close(); }
}

let failed;
try { await suite(playwright.chromium, 'chromium'); await suite(playwright.webkit, 'webkit'); }
catch (error) { failed = error; console.error(error); results.push({ name: error.message, passed: false }); }
finally {
  await new Promise(resolve => server.close(resolve));
  await writeFile(`${output}/results.json`, JSON.stringify({ results, limitations }, null, 2));
}
console.log(`${results.filter(r => r.passed).length} checks passed; ${results.filter(r => !r.passed).length} failed; ${limitations.length} limitations.`);
if (failed) process.exitCode = 1;
