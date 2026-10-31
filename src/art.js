/** Pixel art is drawn at native resolution, then scaled with nearest-neighbor rendering. */
const C = { leaf: '#719b51', light: '#acd071', stem: '#41663c', soil: '#3b2d24', deep: '#281f1b', rim: '#644633', gold: '#e9ba64' };
/** @param {CanvasRenderingContext2D} ctx @param {string} color @param {number} x @param {number} y @param {number} w @param {number} h */
function rect(ctx, color, x, y, w, h) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

/** @param {CanvasRenderingContext2D} ctx @param {string} id @param {number} stage @param {number} [x] @param {number} [y] @param {boolean} [golden] */
export function cropSprite(ctx, id, stage, x = 0, y = 0, golden = false) {
  ctx.save(); ctx.translate(x, y);
  const r = (/** @type {string} */ color, /** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ w, /** @type {number} */ h) => rect(ctx, golden && ![C.leaf, C.light, C.stem].includes(color) ? C.gold : color, a, b, w, h);
  if (stage === 0) {
    r(C.stem, 15, 22, 2, 6); r(C.leaf, 10, 20, 5, 3); r(C.light, 17, 18, 5, 3); r(C.leaf, 17, 21, 2, 2);
  } else if (stage === 1) {
    r(C.stem, 15, 15, 2, 13); r(C.leaf, 7, 17, 8, 3); r(C.light, 9, 15, 5, 3);
    r(C.leaf, 17, 12, 8, 4); r(C.light, 19, 10, 4, 3); r(C.leaf, 17, 23, 5, 3);
  } else if (id === 'radish') {
    r(C.stem, 15, 7, 2, 10); r(C.leaf, 9, 5, 5, 7); r(C.light, 8, 4, 3, 4); r(C.leaf, 18, 3, 5, 8); r(C.light, 21, 2, 3, 5);
    r('#ad4f58', 10, 15, 13, 9); r('#d96c72', 8, 17, 15, 5); r('#ef9390', 10, 15, 6, 3);
    r('#f0d5b5', 11, 23, 10, 3); r('#f0d5b5', 14, 26, 5, 2); r('#d3b99a', 16, 28, 2, 3);
  } else if (id === 'carrot') {
    r(C.stem, 15, 5, 2, 10); r(C.leaf, 9, 3, 3, 8); r(C.light, 14, 2, 3, 8); r(C.leaf, 20, 4, 3, 8); r(C.leaf, 12, 9, 10, 4);
    r('#d8803f', 10, 13, 13, 6); r('#f3a14f', 11, 13, 9, 5); r('#db853e', 12, 19, 10, 5); r('#e99144', 14, 24, 6, 4); r('#c9753b', 15, 28, 3, 3);
    r('#ffd17a', 12, 14, 2, 5); r('#ad6339', 17, 18, 5, 1); r('#ad6339', 14, 24, 3, 1);
  } else if (id === 'pumpkin') {
    r(C.stem, 15, 6, 3, 7); r(C.leaf, 18, 7, 6, 3); r(C.light, 22, 5, 4, 3);
    r('#b96736', 6, 15, 22, 11); r('#dc8a3c', 8, 12, 18, 16); r('#efaa4e', 12, 11, 10, 18); r('#d98035', 15, 12, 2, 16);
    r('#ffca73', 11, 14, 2, 9); r('#aa5b32', 7, 18, 2, 6); r('#bc6731', 23, 17, 2, 7); r('#724c30', 14, 10, 6, 3);
  } else if (id === 'sunflower') {
    r(C.stem, 15, 14, 3, 17); r(C.leaf, 8, 23, 7, 4); r(C.light, 8, 22, 4, 2); r(C.leaf, 18, 20, 7, 4);
    r('#d69a3f', 8, 5, 17, 14); r('#eeb852', 12, 2, 9, 20); r('#eeb852', 5, 8, 23, 8);
    r('#f5d375', 7, 5, 5, 4); r('#f5d375', 21, 5, 4, 4); r('#f5d375', 12, 2, 8, 3);
    r('#64462e', 11, 7, 11, 11); r('#9c6a37', 13, 8, 7, 8); r('#d09b55', 13, 9, 2, 2); r('#533c2b', 17, 12, 3, 3);
  } else {
    r(C.stem, 15, 6, 3, 7); r(C.leaf, 18, 6, 7, 3); r(C.light, 23, 4, 3, 3);
    r('#62688e', 7, 15, 21, 10); r('#8585b4', 10, 12, 15, 16); r('#a4a2cb', 12, 12, 10, 14);
    r('#666d97', 9, 18, 2, 8); r('#666d97', 23, 16, 2, 9);
    r('#eee0a1', 16, 15, 5, 9); r('#eee0a1', 14, 17, 5, 5); r('#a4a2cb', 18, 15, 4, 6); r('#c6c2de', 11, 15, 2, 2);
  }
  if (stage === 2) { // A smaller budding crop, still visibly different from ripe.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillRect(0, 0, 32, 4);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

/** @param {HTMLCanvasElement} canvas @param {string} id @param {number} [stage] */
export function drawSeed(canvas, id, stage = 3) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  cropSprite(ctx, id, stage);
}

/** @param {HTMLCanvasElement} canvas @param {import('./types').Plot | null} plot @param {number} stage @param {boolean} locked @param {number} index */
export function drawPlot(canvas, plot, stage, locked, index) {
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.clearRect(0, 0, 96, 60);
  if (locked) {
    for (let i = 0; i < 17; i++) {
      const x = (i * 23 + index * 7) % 90 + 2, y = (i * 17 + index * 5) % 44 + 10;
      rect(ctx, i % 3 ? '#35392a' : '#444331', x, y, 2, 4); rect(ctx, '#35392a', x - 2, y + 1, 2, 2);
    }
    rect(ctx, '#a69b79', 42, 23, 12, 10); rect(ctx, '#a69b79', 43, 17, 2, 7); rect(ctx, '#a69b79', 51, 17, 2, 7); rect(ctx, '#a69b79', 45, 15, 6, 2);
    rect(ctx, '#343329', 47, 26, 2, 4);
    return;
  }
  for (let row = 0; row < 4; row++) {
    rect(ctx, '#31251e', 8, 25 + row * 8, 80, 3); rect(ctx, '#59402d', 10, 24 + row * 8, 76, 1);
    for (let j = 0; j < 5; j++) rect(ctx, '#735035', 13 + j * 16 + (row % 2) * 3, 23 + row * 8, 2, 1);
  }
  if (plot) {
    rect(ctx, '#2e251f', 35, 45, 26, 4);
    ctx.save();
    const scale = stage === 2 ? 1.2 : stage === 3 ? 1.5 : 1.25;
    ctx.translate(48 - 16 * scale, 49 - 32 * scale); ctx.scale(scale, scale); ctx.imageSmoothingEnabled = false;
    cropSprite(ctx, plot.crop, stage); ctx.restore();
    if (stage === 3) { rect(ctx, '#e9ba64', 72, 11, 1, 5); rect(ctx, '#e9ba64', 70, 13, 5, 1); }
  } else {
    rect(ctx, '#b59a70', 47, 18, 2, 12); rect(ctx, '#b59a70', 42, 23, 12, 2);
  }
}

/** @param {CanvasRenderingContext2D} ctx @param {number} x @param {number} y @param {number} r @param {string} color @param {number} thickness */
function ring(ctx, x, y, r, color, thickness) {
  for (let a = 0; a < Math.PI * 2; a += 0.015) rect(ctx, color, x + Math.cos(a) * r, y + Math.sin(a) * r, thickness, thickness);
}
/** @param {CanvasRenderingContext2D} ctx @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2 @param {string} color @param {number} [size] */
function pixelLine(ctx, x1, y1, x2, y2, color, size = 1) {
  const count = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let n = 0; n <= count; n++) rect(ctx, color, x1 + (x2 - x1) * n / count, y1 + (y2 - y1) * n / count, size, size);
}

/** @param {CanvasRenderingContext2D} ctx @param {boolean} running @param {number} phase @param {boolean} [stale] */
export function drawWheelScene(ctx, running, phase, stale = false) {
  const night = !running;
  const w = 280, h = 220;
  ctx.clearRect(0, 0, w, h);
  rect(ctx, night ? '#21292a' : '#343c2d', 0, 0, w, h);
  rect(ctx, night ? '#2a3330' : '#414a32', 0, 113, w, 72);
  // A quiet patch of sky, chunky stars, and one warm sun or crescent moon.
  if (night) {
    for (let i = 0; i < 25; i++) rect(ctx, i % 4 ? '#8c9676' : '#c8bd8d', (i * 43 + 13) % 270, (i * 31 + 9) % 112, i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    rect(ctx, '#d8d4a3', 231, 21, 15, 21); rect(ctx, '#d8d4a3', 227, 25, 23, 13);
    rect(ctx, '#21292a', 238, 19, 14, 17); rect(ctx, '#21292a', 242, 32, 10, 5);
  } else {
    rect(ctx, '#e0bc6c', 229, 24, 16, 16); rect(ctx, '#f0cd83', 232, 21, 10, 22);
    rect(ctx, '#737654', 21, 33, 24, 4); rect(ctx, '#737654', 28, 29, 12, 4);
    rect(ctx, '#737654', 180, 51, 22, 3); rect(ctx, '#737654', 186, 47, 12, 4);
  }
  // Distant hedges and a timber fence.
  for (let i = 0; i < 12; i++) {
    const x = i * 26 - 12;
    rect(ctx, night ? '#303c2f' : '#4a5636', x, 124 - (i % 3) * 8, 25, 56);
    rect(ctx, night ? '#354032' : '#53623c', x + 5, 117 - (i % 3) * 8, 15, 54);
  }
  rect(ctx, '#5b4a36', 0, 157, 280, 4); rect(ctx, '#51402f', 0, 173, 280, 3);
  for (let i = 0; i < 12; i++) { rect(ctx, '#6d563b', i * 26 + 5, 147, 4, 38); rect(ctx, '#816847', i * 26 + 5, 147, 2, 34); }
  rect(ctx, '#3e422e', 0, 183, w, 37); rect(ctx, '#343828', 0, 200, w, 20);
  for (let i = 0; i < 90; i++) {
    const x = (i * 47) % 280, y = 185 + (i * 23) % 35;
    rect(ctx, ['#52583a', '#64683f', '#333a29'][i % 3], x, y, 2, i % 4 + 1);
  }
  // Wheel feet, supports, and warm wooden rim.
  rect(ctx, '#252b23', 83, 191, 112, 6);
  pixelLine(ctx, 137, 121, 105, 190, '#796044', 5); pixelLine(ctx, 141, 121, 173, 190, '#796044', 5);
  rect(ctx, '#a08456', 96, 190, 89, 5); rect(ctx, '#67503b', 101, 195, 80, 3);
  const cx = 139, cy = 112, radius = 64;
  ring(ctx, cx + 2, cy + 2, radius, '#1f2622', 6);
  ring(ctx, cx, cy, radius, '#ba9762', 4); ring(ctx, cx, cy, radius - 5, '#735d40', 2);
  ring(ctx, cx, cy, radius + 2, '#d0ac72', 1);
  for (let a = 0; a < 12; a++) {
    const angle = a * Math.PI / 6 + phase;
    pixelLine(ctx, cx, cy, cx + Math.cos(angle) * 58, cy + Math.sin(angle) * 58, '#756748', 1);
    rect(ctx, '#e0bd7e', cx + Math.cos(angle) * 62, cy + Math.sin(angle) * 62, 3, 3);
  }
  rect(ctx, '#ccb27a', cx - 4, cy - 4, 9, 9); rect(ctx, '#655638', cx - 2, cy - 2, 5, 5);
  // Squeektoshi: cheeks, ears, cream belly, bright eye, tiny paws.
  const bob = running ? Math.round(Math.sin(phase * 6) * 2) : 0;
  const hx = running ? 126 : 124, hy = 144 + bob;
  rect(ctx, '#343024', hx - 5, hy + 24, 48, 4);
  rect(ctx, '#b78555', hx - 6, hy + 8, 5, 7);
  rect(ctx, '#c9925e', hx, hy + 2, 30, 22); rect(ctx, '#e4b67c', hx + 3, hy, 23, 22);
  rect(ctx, '#e4b67c', hx + 24, hy + 6, 12, 17); rect(ctx, '#f2d2a0', hx + 5, hy + 13, 26, 11);
  rect(ctx, '#e4b67c', hx + 22, hy - 5, 8, 10); rect(ctx, '#d59279', hx + 24, hy - 3, 4, 5);
  rect(ctx, '#f3d3a0', hx + 30, hy + 13, 8, 7); rect(ctx, '#b47764', hx + 36, hy + 13, 3, 3);
  if (running) { rect(ctx, '#30271f', hx + 29, hy + 8, 3, 4); rect(ctx, '#fcdfaf', hx + 30, hy + 8, 1, 1); }
  else { rect(ctx, '#55402e', hx + 27, hy + 10, 5, 1); rect(ctx, '#55402e', hx + 26, hy + 9, 1, 1); }
  rect(ctx, '#cf9970', hx + 5 + (running ? Math.round(Math.sin(phase * 6) * 3) : 0), hy + 24, 8, 3);
  rect(ctx, '#e6b987', hx + 25, hy + 23, 8, 3);
  if (night) {
    ctx.fillStyle = '#d8c99e'; ctx.font = '14px VT323'; ctx.fillText('z', 171, 141); ctx.fillText('z', 180, 131); ctx.fillText('z', 190, 118);
  }
  // A sunflower by the fence and small flowers at the edge of the garden.
  ctx.save(); ctx.translate(22, 155); cropSprite(ctx, 'sunflower', 3); ctx.restore();
  rect(ctx, '#737b48', 246, 175, 2, 19); rect(ctx, '#71904d', 242, 183, 5, 3);
  rect(ctx, '#d2aa65', 242, 173, 10, 5); rect(ctx, '#d2aa65', 245, 170, 4, 11); rect(ctx, '#6d4f32', 245, 174, 4, 3);
  rect(ctx, '#8d8660', 62, 202, 7, 3); rect(ctx, '#a79a6d', 64, 200, 4, 2);
  if (stale) { ctx.fillStyle = 'rgba(26, 27, 22, 0.22)'; ctx.fillRect(0, 0, w, h); }
}
