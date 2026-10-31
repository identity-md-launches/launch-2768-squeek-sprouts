import { CROPS, PLOT_COSTS, applyWheel, buyPlot, cropById, demoWheel, harvest, newGarden, parseStatus, plant, progress, validGarden } from './engine.js';
import { drawPlot, drawSeed, drawWheelScene } from './art.js';
import { loadGarden, saveGarden, storageKey } from './storage.js';

/** @template {HTMLElement} T @param {string} id @returns {T} */
function get(id) { const node = document.getElementById(id); if (!node) throw new Error(`Missing ${id}`); return /** @type {T} */ (node); }
/** @param {string} id @param {string} text */
function setText(id, text) { const node = get(id); if (node.textContent !== text) node.textContent = text; }
/** @param {string | number | bigint} n */
function number(n) { return typeof n === 'number' ? n.toLocaleString('en-US', { maximumFractionDigits: 1 }) : BigInt(n).toLocaleString('en-US'); }
const API = 'https://api.squeekchain.com/v1/status';
/** @type {import('./types').Mode} */
let mode = 'live';
let loaded = loadGarden(mode);
let state = loaded.state;
/** @type {import('./types').Wheel | null} */
let liveWheel = null;
/** @type {import('./types').Wheel | null} */
let wheel = null;
let failures = 0, inFlight = false, resetArmed = false, journalExpanded = false, animationPaused = false;
let saveOK = true;
let lastJournal = '';
let lastStatus = '';
let wasRunning = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = /** @type {HTMLCanvasElement} */ (get('wheel-canvas'));
const scene = canvas.getContext('2d');
const help = /** @type {HTMLDialogElement} */ (get('help-dialog'));
const seedButtons = CROPS.map(crop => {
  const button = document.createElement('button'); button.className = 'seed-button'; button.type = 'button'; button.dataset.crop = crop.id;
  const sprite = document.createElement('canvas'); sprite.width = 32; sprite.height = 32; sprite.setAttribute('aria-hidden', 'true');
  drawSeed(sprite, crop.id);
  const name = document.createElement('span'); name.className = 'seed-name';
  const fullName = document.createElement('span'); fullName.className = 'seed-full-name'; fullName.textContent = crop.name;
  const shortName = document.createElement('span'); shortName.className = 'seed-short-name'; shortName.textContent = crop.short;
  name.append(fullName, shortName);
  const price = document.createElement('span'); price.className = 'seed-price';
  const details = document.createElement('span'); details.className = 'seed-meta'; details.textContent = `${number(crop.work)} work · Sells ${crop.sell}`;
  button.append(sprite, name, price, details); get('seed-list').append(button);
  button.addEventListener('click', () => {
    cancelReset();
    if (state.earned < crop.unlock) {
      feedback(`${crop.name} unlocks at ${number(crop.unlock)} total crumbs earned. ${number(crop.unlock - state.earned)} to go.`, 'error');
      setSeedDetail(crop, true); return;
    }
    state.selected = crop.id; persist(); render();
    feedback(`${crop.name} selected. ${crop.cost ? `${crop.cost} crumbs per seed.` : 'Seeds are free.'} Choose an empty plot.`);
  });
  return { button, price, details };
});
const plotButtons = Array.from({ length: 9 }, (_, index) => {
  const button = document.createElement('button'); button.type = 'button'; button.className = 'plot'; button.dataset.plot = String(index);
  const count = document.createElement('span'); count.className = 'plot-number'; count.textContent = String(index + 1); count.setAttribute('aria-hidden', 'true');
  const sprite = document.createElement('canvas'); sprite.width = 96; sprite.height = 60; sprite.setAttribute('aria-hidden', 'true');
  const label = document.createElement('span'); label.className = 'plot-label';
  const sub = document.createElement('span'); sub.className = 'plot-sub';
  const bar = document.createElement('progress'); bar.className = 'plot-progress'; bar.setAttribute('aria-hidden', 'true');
  button.append(count, sprite, label, sub, bar); get('garden').append(button);
  button.addEventListener('click', () => onPlot(index));
  return { button, sprite, label, sub, bar };
});

/** @param {string} text @param {'normal'|'error'|'golden'} [kind] */
function feedback(text, kind = 'normal') { setText('feedback', text); get('feedback').className = `feedback ${kind}`; }
function persist() {
  state.updatedAt = Date.now();
  saveOK = saveGarden(mode, state);
  if (!saveOK) {
    get('storage-warning').hidden = false;
    setText('storage-warning', 'Browser storage is unavailable. Keep this tab open to keep your garden.');
  }
  get('save-status').lastChild?.remove();
  get('save-status').append(document.createTextNode(saveOK ? 'Saved locally' : 'This visit only'));
}
function cancelReset() { resetArmed = false; setText('reset-button', 'Reset garden'); get('reset-button').classList.remove('armed'); get('reset-cancel').hidden = true; }
function online() { return Boolean(wheel?.online && Date.now() < wheel.expiresAt); }
function running() { return online() && Boolean(wheel?.running); }

/** @param {number} index */
function onPlot(index) {
  cancelReset();
  let result;
  if (index >= state.openPlots) result = buyPlot(state, index);
  else if (state.plots[index]) result = harvest(state, index, running());
  else if (!online()) result = { ok: false, message: 'Waiting for a fresh wheel signal. Try the demo to plant right now.' };
  else result = plant(state, index);
  if (result.ok) { persist(); render(); }
  // Keep the immediate result on the tapped plot, including on short phone screens.
  const plot = state.plots[index];
  if (!result.ok && plot) {
    plotButtons[index].sub.textContent = `${cropById(plot.crop).work - progress(state, plot)} work left`;
  } else if (!result.ok && index === state.openPlots) {
    plotButtons[index].sub.textContent = `Need ${PLOT_COSTS[index - 3] - state.crumbs} more`;
  } else if (result.reward) {
    plotButtons[index].sub.textContent = `${result.golden ? 'Golden' : running() ? 'Fresh' : 'Picked'} +${result.reward}`;
  }
  feedback(result.message, result.golden ? 'golden' : result.ok ? 'normal' : 'error');
}
/** @param {import('./types').Crop} crop @param {boolean} [locked] */
function setSeedDetail(crop, locked = false) {
  const row = get('seed-detail');
  if (row.children[0]) row.children[0].textContent = crop.name;
  if (row.children[1]) row.children[1].textContent = locked ? `${number(crop.unlock)} earned to unlock · ${number(crop.work)} work · Sells for ${crop.sell}` : `${number(crop.work)} work · Sells for ${crop.sell}`;
}

function render() {
  setText('crumbs', number(state.crumbs));
  get('crumbs').setAttribute('aria-label', `${state.crumbs} crumbs available`);
  setText('plot-count', `${state.openPlots} of 9 plots open`);
  setText('grown-value', number(state.grown));
  const chosen = cropById(state.selected);
  setText('garden-instruction', `Select an empty plot to plant ${chosen.id === 'sunflower' ? 'a sunflower' : chosen.id === 'melon' ? 'a melon' : `a ${chosen.short.toLowerCase()}`}.`);
  for (const [i, crop] of CROPS.entries()) {
    const { button, price, details } = seedButtons[i];
    const locked = state.earned < crop.unlock;
    button.classList.toggle('locked', locked);
    button.setAttribute('aria-pressed', String(state.selected === crop.id));
    button.setAttribute('aria-label', `${crop.name}. ${locked ? `Locked: earn ${crop.unlock} crumbs. ` : ''}${crop.cost ? `${crop.cost} crumbs per seed` : 'Free seeds'}. ${crop.work} work to ripen. Sells for ${crop.sell}.`);
    details.hidden = locked;
    price.textContent = locked ? `${number(crop.unlock)} earned` : crop.cost ? `${crop.cost} crumbs` : 'Free';
    button.title = `${crop.name} · ${crop.cost ? `${crop.cost} crumbs` : 'Free'} · ${crop.work} work · Sells for ${crop.sell}${locked ? ` · Unlocks at ${crop.unlock} earned` : ''}`;
  }
  setSeedDetail(chosen);
  for (const [i, refs] of plotButtons.entries()) {
    const { button, sprite, label, sub, bar } = refs;
    const locked = i >= state.openPlots, plot = state.plots[i];
    const crop = plot ? cropById(plot.crop) : null;
    const done = plot ? progress(state, plot) : 0;
    const ripe = crop !== null && done >= crop.work;
    const stage = crop ? ripe ? 3 : Math.min(2, Math.floor(done / crop.work * 3)) : 0;
    button.className = `plot ${locked ? 'locked' : plot ? ripe ? 'ripe' : 'growing' : 'empty'}${i === state.openPlots ? ' next-plot' : ''}`;
    bar.hidden = !plot; bar.max = crop?.work ?? 1; bar.value = done;
    if (locked) {
      const cost = PLOT_COSTS[i - 3];
      label.textContent = `${number(cost)} crumbs`;
      sub.textContent = i === state.openPlots ? 'Open plot' : 'Locked plot';
      button.setAttribute('aria-label', `Plot ${i + 1}. ${i === state.openPlots ? `Open plot for ${cost} crumbs.` : `Locked plot, ${cost} crumbs. Open plot ${state.openPlots + 1} first.`}`);
    } else if (crop) {
      label.textContent = ripe ? 'Harvest' : crop.short;
      sub.textContent = ripe ? (running() ? 'Fresh bonus 2×' : 'Ready to pick') : `${done} / ${number(crop.work)} work`;
      button.setAttribute('aria-label', `Plot ${i + 1}. ${crop.name}. ${ripe ? 'Ripe. Harvest crop.' : `${crop.work - done} wheel work left. Inspect growing crop.`}`);
    } else {
      label.textContent = `Plant ${chosen.short.toLowerCase()}`;
      sub.textContent = chosen.cost ? `${chosen.cost} crumbs` : 'Free seed';
      button.setAttribute('aria-label', `Plot ${i + 1}. Plant ${chosen.name}. ${chosen.cost ? `${chosen.cost} crumbs` : 'Free seed'}.`);
    }
    drawPlot(sprite, plot, stage, locked, i);
  }
  renderStatus(); renderJournal(); drawFrame();
}
function renderJournal() {
  const signature = JSON.stringify(state.journal) + journalExpanded;
  if (signature === lastJournal) return;
  lastJournal = signature;
  const list = get('journal-list'); list.replaceChildren();
  for (const entry of state.journal.slice(0, journalExpanded ? 80 : 4)) {
    const row = document.createElement('li'); row.className = `journal-entry ${entry.kind}`;
    const time = document.createElement('time'); time.dateTime = new Date(entry.at).toISOString();
    const sameDay = new Date(entry.at).toDateString() === new Date().toDateString();
    time.textContent = sameDay ? new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : new Date(entry.at).toLocaleDateString([], { month: 'short', day: 'numeric' });
    time.title = new Date(entry.at).toLocaleString();
    const dot = document.createElement('span'); dot.className = 'journal-dot'; dot.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span'); text.textContent = entry.text;
    row.append(time, dot, text); list.append(row);
  }
  setText('journal-summary', state.harvests ? `${number(state.harvests)} harvested · ${number(state.goldens)} golden` : 'Your story starts here');
  get('journal-more').hidden = state.journal.length <= 4;
  setText('journal-more', journalExpanded ? 'Show fewer entries' : `Show older entries (${state.journal.length - 4})`);
}
function renderStatus() {
  const active = running(), fresh = online();
  const current = mode === 'demo' ? active ? 'Demo · Running' : 'Demo · Napping' : fresh ? active ? 'Running · Growing' : 'Napping · Garden sleeps' : failures || wheel ? 'Stale · Garden paused' : 'Connecting to the wheel';
  if (current !== lastStatus) {
    setText('status-text', current); lastStatus = current;
    get('wheel-status').className = `status-pill${active ? ' running' : !fresh && wheel ? ' stale' : ''}`;
    setText('wheel-note', !fresh && (failures || wheel) ? 'Signal stale, garden paused.' : active ? 'Little paws. A lot of possibility.' : 'Even little gardeners need a rest.');
    setText('scene-tag', !fresh && (failures || wheel) ? 'Waiting for the signal' : active ? 'Go, little guy, go' : 'A well-earned nap');
    canvas.setAttribute('aria-label', active ? 'Squeektoshi running on a wooden wheel in a sunny pixel garden' : 'Squeektoshi sleeping on his wheel under a crescent moon');
  }
  setText('signal-text', fresh ? mode === 'demo' ? 'Simulated wheel' : 'Live · checks every 15s' : failures ? 'Retrying every 15s' : 'Checking the signal…');
  setText('data-source', mode === 'demo' ? 'Demo data' : fresh ? 'Live data' : 'Last known');
  setText('block-label', mode === 'demo' ? 'Demo block' : 'Squeek block');
  setText('bonus-hint', active ? 'Fresh bonus active · 2×' : 'Fresh harvests earn 2×');
  get('mode-notice').hidden = mode !== 'demo';
  get('demo-button').hidden = mode === 'demo';
  if (wheel) {
    setText('work-value', number(state.lastWork ?? wheel.work));
    setText('rpm-value', number(wheel.rpm));
    setText('speed-value', wheel.speed.toFixed(2));
    setText('distance-value', wheel.distance.toFixed(2));
    setText('block-value', number(wheel.block));
  } else {
    setText('work-value', state.lastWork === null ? '···' : number(state.lastWork));
    for (const id of ['rpm-value', 'speed-value', 'distance-value', 'block-value']) setText(id, '···');
  }
  if (active !== wasRunning) {
    wasRunning = active;
    for (let i = 0; i < state.plots.length; i++) {
      const plot = state.plots[i];
      if (plot && progress(state, plot) === cropById(plot.crop).work) plotButtons[i].sub.textContent = active ? 'Fresh bonus 2×' : 'Ready to pick';
    }
    syncAnimation();
  }
}

/** @param {import('./types').Mode} next @param {boolean} [automatic] */
function switchMode(next, automatic = false) {
  if (mode === next) return;
  persist(); mode = next; loaded = loadGarden(mode); state = loaded.state;
  wheel = mode === 'demo' ? demoWheel(state) : liveWheel;
  if (wheel) applyWheel(state, wheel);
  cancelReset(); persist(); render();
  feedback(next === 'demo' ? automatic ? 'The live signal missed twice. This demo garden has its own save.' : 'Welcome to your demo garden. Its wheel and rewards are simulated.' : 'Back in your live garden. Squeektoshi takes it from here.');
}

async function poll() {
  if (inFlight) return;
  inFlight = true;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(API, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new Error(`Wheel signal returned ${response.status}`);
    const next = parseStatus(await response.json());
    liveWheel = next; failures = 0;
    if (mode === 'live') {
      wheel = next;
      const before = state.journal.filter(e => e.kind === 'ripe').length;
      applyWheel(state, next); persist(); render();
      const count = state.journal.filter(e => e.kind === 'ripe').length - before;
      if (count > 0) feedback(`${count === 1 ? 'A crop is' : `${count} crops are`} ready to pick. Your patience grew something good.`);
    }
  } catch {
    failures++;
    if (liveWheel) liveWheel = { ...liveWheel, online: false, running: false };
    if (mode === 'live') {
      wheel = liveWheel;
      renderStatus(); drawFrame();
      if (failures >= 2) switchMode('demo', true);
    }
  } finally { clearTimeout(timeout); inFlight = false; }
}

let phase = 0, previousFrame = 0, frameId = 0;
function drawFrame() { if (scene) drawWheelScene(scene, running(), phase, !online()); }
/** @param {number} timestamp */
function animate(timestamp) {
  const delta = previousFrame ? Math.min(64, timestamp - previousFrame) : 0; previousFrame = timestamp;
  if (running()) phase += delta / 1000 * Math.PI * 2 * (wheel?.rpm ?? 0) / 60 * 0.35;
  drawFrame();
  if (running() && !animationPaused && !reducedMotion.matches && !document.hidden) frameId = requestAnimationFrame(animate);
}
function syncAnimation() {
  cancelAnimationFrame(frameId); previousFrame = 0;
  const paused = animationPaused || reducedMotion.matches;
  get('motion-button').setAttribute('aria-pressed', String(paused));
  get('motion-button').setAttribute('aria-label', reducedMotion.matches ? 'Animation paused by reduced motion preference' : paused ? 'Play animation' : 'Pause animation');
  const path = get('motion-button').querySelector('path');
  if (path) path.setAttribute('d', paused ? 'M5 3l8 5-8 5z' : 'M5 4v8M11 4v8');
  if (running() && !paused && !document.hidden) frameId = requestAnimationFrame(animate); else drawFrame();
}

get('demo-button').addEventListener('click', () => switchMode('demo'));
get('return-live').addEventListener('click', () => switchMode('live'));
get('motion-button').addEventListener('click', () => { animationPaused = !animationPaused; syncAnimation(); });
reducedMotion.addEventListener('change', syncAnimation);
get('help-button').addEventListener('click', () => { cancelReset(); help.showModal(); });
get('close-help').addEventListener('click', () => help.close());
get('start-growing').addEventListener('click', () => { help.close(); get('garden').focus(); });
help.addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const controls = [...help.querySelectorAll('button:not(:disabled), a[href]')];
  const first = /** @type {HTMLElement | undefined} */ (controls[0]);
  const last = /** @type {HTMLElement | undefined} */ (controls.at(-1));
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
help.addEventListener('click', e => { if (e.target === help) { const box = help.getBoundingClientRect(); if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) help.close(); } });
get('journal-more').addEventListener('click', () => { journalExpanded = !journalExpanded; renderJournal(); });
get('reset-cancel').addEventListener('click', cancelReset);
get('reset-button').addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true; get('reset-button').classList.add('armed');
    setText('reset-button', `Tap again to reset ${mode} garden`); get('reset-cancel').hidden = false;
    feedback(`This clears your ${mode} crops, crumbs and journal. Tap reset again or cancel.`, 'error');
    return;
  }
  state = newGarden();
  if (mode === 'demo') wheel = demoWheel(state);
  if (wheel) applyWheel(state, wheel);
  cancelReset(); persist(); render(); feedback('A fresh start. 10 crumbs, 3 plots, and a little possibility.');
});
document.addEventListener('visibilitychange', () => { syncAnimation(); if (!document.hidden) void poll(); });
window.addEventListener('online', () => void poll());
window.addEventListener('offline', () => {
  if (liveWheel) liveWheel = { ...liveWheel, online: false, running: false };
  if (mode === 'live') { failures = Math.max(failures, 1); wheel = liveWheel; renderStatus(); drawFrame(); }
});
window.addEventListener('storage', event => {
  if (event.key !== storageKey(mode) || !event.newValue) return;
  try { const updated = JSON.parse(event.newValue); if (validGarden(updated) && updated.updatedAt >= state.updatedAt) { state = updated; render(); } } catch { /* Other tabs cannot inject invalid saves. */ }
});
window.addEventListener('pagehide', () => { persist(); cancelAnimationFrame(frameId); });

if (loaded.warning) { get('storage-warning').hidden = false; setText('storage-warning', loaded.warning); }
render(); syncAnimation(); void poll();
setInterval(() => void poll(), 15000);
setInterval(() => {
  if (mode === 'demo') { wheel = demoWheel(state); applyWheel(state, wheel); persist(); render(); }
  else { renderStatus(); if (!running()) drawFrame(); }
}, 1000);
