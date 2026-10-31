/** @typedef {import('./types').Garden} Garden */
/** @typedef {import('./types').Crop} Crop */
/** @typedef {import('./types').Wheel} Wheel */
/** @typedef {import('./types').Result} Result */

/** @type {readonly Crop[]} */
export const CROPS = Object.freeze([
  { id: 'radish', name: 'Wheel Radish', short: 'Radish', work: 40, cost: 0, sell: 6, unlock: 0 },
  { id: 'carrot', name: 'Zoomie Carrot', short: 'Carrot', work: 120, cost: 8, sell: 20, unlock: 30 },
  { id: 'pumpkin', name: 'Round Pumpkin', short: 'Pumpkin', work: 400, cost: 30, sell: 70, unlock: 150 },
  { id: 'sunflower', name: 'Rim Sunflower', short: 'Sunflower', work: 1000, cost: 90, sell: 190, unlock: 500 },
  { id: 'melon', name: 'Moon Melon', short: 'Melon', work: 3000, cost: 260, sell: 600, unlock: 1500 },
]);
export const PLOT_COSTS = Object.freeze([25, 60, 120, 250, 500, 1000]);
/** @param {string} id @returns {Crop} */
export function cropById(id) { return CROPS.find(c => c.id === id) ?? CROPS[0]; }

/** @param {number} [now] @returns {Garden} */
export function newGarden(now = Date.now()) {
  return {
    version: 1, crumbs: 10, earned: 0, openPlots: 3,
    plots: Array(9).fill(null), selected: 'radish', lastWork: null, epoch: null,
    grown: '0', harvests: 0, goldens: 0, updatedAt: now, demoAt: now,
    journal: [{ at: now, text: 'A little patch of possibility. Plant your first radish.', kind: 'note' }],
  };
}
/** @param {Garden} state @param {string} text @param {import('./types').Entry['kind']} [kind] @param {number} [now] */
export function log(state, text, kind = 'note', now = Date.now()) {
  state.journal.unshift({ at: now, text, kind });
  state.journal = state.journal.slice(0, 80);
}
/** Exact integer math keeps very large chain counters safe. @param {Garden} state @param {import('./types').Plot} plot */
export function progress(state, plot) {
  if (state.lastWork === null) return 0;
  const delta = BigInt(state.lastWork) - BigInt(plot.planted);
  const target = BigInt(cropById(plot.crop).work);
  return Number(delta < 0n ? 0n : delta > target ? target : delta);
}

/** Accept only online measurements; a reset preserves the full previous delta.
 * @param {Garden} state @param {Wheel} wheel @param {number} [now]
 */
export function applyWheel(state, wheel, now = Date.now()) {
  if (!wheel.online || now >= wheel.expiresAt) return;
  const next = BigInt(wheel.work);
  const last = state.lastWork === null ? null : BigInt(state.lastWork);
  if (last !== null && (wheel.epoch !== state.epoch || next < last)) {
    for (const plot of state.plots) {
      if (plot) plot.planted = (next - (last - BigInt(plot.planted))).toString();
    }
    log(state, 'Wheel counter restarted. Every sprout kept its progress.', 'restart', now);
  } else if (last !== null) {
    state.grown = (BigInt(state.grown) + next - last).toString();
  }
  state.lastWork = next.toString();
  state.epoch = wheel.epoch;
  for (const plot of state.plots) {
    if (plot && !plot.ripeLogged && progress(state, plot) >= cropById(plot.crop).work) {
      plot.ripeLogged = true;
      log(state, `${cropById(plot.crop).name} is ripe. Ready when you are.`, 'ripe', now);
    }
  }
  state.updatedAt = now;
}

/** @param {Garden} state @param {number} index @returns {Result} */
export function plant(state, index) {
  if (!Number.isInteger(index) || index < 0 || index >= state.openPlots) return { ok: false, message: 'Open this plot before planting.' };
  if (state.plots[index]) return { ok: false, message: 'This plot already has a crop.' };
  if (state.lastWork === null) return { ok: false, message: 'Waiting for the wheel signal. You can also try the demo.' };
  const crop = cropById(state.selected);
  if (state.earned < crop.unlock) return { ok: false, message: `Earn ${crop.unlock} crumbs to unlock ${crop.name}.` };
  if (state.crumbs < crop.cost) return { ok: false, message: `You need ${crop.cost - state.crumbs} more crumbs. Radish seeds are always free.` };
  state.crumbs -= crop.cost;
  state.plots[index] = { crop: crop.id, planted: state.lastWork, ripeLogged: false };
  log(state, `Planted ${crop.name} in plot ${index + 1}.`, 'plant');
  return { ok: true, message: `${crop.name} planted. ${crop.work} wheel work to grow.` };
}

/** @param {Garden} state @param {number} index @param {boolean} running @param {() => number} [random] @returns {Result} */
export function harvest(state, index, running, random = Math.random) {
  const plot = state.plots[index];
  if (!plot) return { ok: false, message: 'Plant a seed in this plot first.' };
  const crop = cropById(plot.crop);
  const left = crop.work - progress(state, plot);
  if (left > 0) return { ok: false, message: `${crop.name}: ${left} wheel work left. Squeektoshi sets the pace.` };
  const golden = running && random() < 0.15;
  const reward = crop.sell * (running ? 2 : 1) * (golden ? 5 : 1);
  const previousEarned = state.earned;
  state.crumbs += reward;
  state.earned += reward;
  state.harvests++;
  if (golden) state.goldens++;
  state.plots[index] = null;
  const message = `${golden ? 'Golden ' : running ? 'Fresh ' : ''}${crop.name} harvested! +${reward} crumbs.`;
  log(state, message, golden ? 'golden' : 'harvest');
  for (const seed of CROPS) {
    if (previousEarned < seed.unlock && state.earned >= seed.unlock) log(state, `${seed.name} unlocked in the seed shed.`, 'unlock');
  }
  return { ok: true, message, reward, golden };
}

/** @param {Garden} state @param {number} index @returns {Result} */
export function buyPlot(state, index) {
  if (state.openPlots >= 9) return { ok: false, message: 'Your whole garden is open.' };
  if (index !== state.openPlots) return { ok: false, message: `Open plot ${state.openPlots + 1} first.` };
  const cost = PLOT_COSTS[state.openPlots - 3];
  if (state.crumbs < cost) return { ok: false, message: `This plot costs ${cost} crumbs. Harvest ${cost - state.crumbs} more to open it.` };
  state.crumbs -= cost;
  state.openPlots++;
  log(state, `Opened plot ${index + 1} for ${cost} crumbs. More room to grow.`, 'unlock');
  return { ok: true, message: `Plot ${index + 1} is yours. Plant something good.` };
}

/** Validate untrusted public data before touching a garden.
 * @param {unknown} payload @param {number} [now] @returns {Wheel}
 */
export function parseStatus(payload, now = Date.now()) {
  if (!payload || typeof payload !== 'object') throw new Error('Missing wheel status');
  const data = /** @type {Record<string, any>} */ (payload);
  const m = data.measurement;
  if (!m || typeof m.cumulativeWorkUnits !== 'string' || !/^\d+$/.test(m.cumulativeWorkUnits) || m.cumulativeWorkUnits.length > 100 || typeof m.counterEpoch !== 'string' || !m.counterEpoch || !['SPINNING', 'IDLE'].includes(m.coreStatus)) throw new Error('Invalid wheel measurement');
  for (const key of ['rpmMilli', 'speedMmPerSecond', 'distanceMm']) {
    if (typeof m[key] !== 'number' || !Number.isFinite(m[key]) || m[key] < 0) throw new Error(`Invalid ${key}`);
  }
  const block = data.builder?.projected?.blockHeight;
  if ((typeof block !== 'string' && typeof block !== 'number') || !/^\d+$/.test(String(block))) throw new Error('Invalid block height');
  const online = m.freshness === 'online';
  // Never let an old online response grant an unlimited fresh-harvest window.
  const lifetime = typeof m.staleAfterSeconds === 'number' && m.staleAfterSeconds > 0 ? Math.min(m.staleAfterSeconds, 120) * 1000 : 45000;
  const observed = typeof m.observedAt === 'string' ? Date.parse(m.observedAt) : NaN;
  const age = Number.isFinite(observed) ? Math.max(0, now - observed) : 0;
  return { work: m.cumulativeWorkUnits, epoch: m.counterEpoch, online, running: online && m.coreStatus === 'SPINNING', rpm: m.rpmMilli / 1000, speed: m.speedMmPerSecond / 1000, distance: m.distanceMm / 1000000, block: String(block), receivedAt: now, expiresAt: now + Math.max(0, Math.min(45000, lifetime - age)) };
}

/** A separate simulation: 60 seconds running, 30 napping, four work per running second.
 * @param {Garden} state @param {number} [now] @returns {Wheel}
 */
export function demoWheel(state, now = Date.now()) {
  const totalRunning = (/** @type {number} */ ms) => Math.floor(ms / 90000) * 60000 + Math.min(ms % 90000, 60000);
  const elapsed = Math.max(0, Math.floor(totalRunning(now) / 250) - Math.floor(totalRunning(state.demoAt) / 250));
  const work = BigInt(state.lastWork ?? '0') + BigInt(elapsed);
  state.demoAt = Math.max(state.demoAt, now);
  const running = now % 90000 < 60000;
  return { work: work.toString(), epoch: 'demo-v1', online: true, running, rpm: running ? 128 : 0, speed: running ? 0.42 : 0, distance: Number(work % 1000000000n) * 0.0001, block: (work / 12n).toString(), receivedAt: now, expiresAt: now + 45000 };
}

/** Invalid saves are rejected, not partially trusted. @param {unknown} value @returns {value is Garden} */
export function validGarden(value) {
  if (!value || typeof value !== 'object') return false;
  const s = /** @type {Garden} */ (value);
  const natural = (/** @type {unknown} */ n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0;
  const timestamp = (/** @type {number} */ n) => natural(n) && n <= 8640000000000000;
  const decimal = (/** @type {unknown} */ n, signed = false) => typeof n === 'string' && n.length <= 110 && (signed ? /^-?\d+$/ : /^\d+$/).test(n);
  return s.version === 1 && natural(s.crumbs) && natural(s.earned) && s.crumbs <= s.earned + 10 && natural(s.openPlots) && s.openPlots >= 3 && s.openPlots <= 9 &&
    CROPS.some(c => c.id === s.selected && s.earned >= c.unlock) && (s.lastWork === null || decimal(s.lastWork)) && (s.epoch === null || typeof s.epoch === 'string') && decimal(s.grown) &&
    natural(s.harvests) && natural(s.goldens) && s.goldens <= s.harvests && timestamp(s.updatedAt) && timestamp(s.demoAt) &&
    Array.isArray(s.plots) && s.plots.length === 9 && s.plots.every((p, i) => p === null || (i < s.openPlots && s.lastWork !== null && p && CROPS.some(c => c.id === p.crop) && decimal(p.planted, true) && BigInt(p.planted) <= BigInt(s.lastWork) && typeof p.ripeLogged === 'boolean')) &&
    Array.isArray(s.journal) && s.journal.length <= 80 && s.journal.every(e => e && timestamp(e.at) && typeof e.text === 'string' && e.text.length <= 400 && ['note', 'plant', 'ripe', 'harvest', 'golden', 'unlock', 'restart'].includes(e.kind));
}
