import { newGarden, validGarden } from './engine.js';
/** @param {import('./types').Mode} mode */
export function storageKey(mode) { return `squeek-sprouts:v1:${mode}`; }
/** @param {import('./types').Mode} mode */
export function loadGarden(mode) {
  try {
    const raw = localStorage.getItem(storageKey(mode));
    if (raw === null) return { state: newGarden(), warning: '' };
    const parsed = JSON.parse(raw);
    if (validGarden(parsed)) return { state: parsed, warning: '' };
    return { state: newGarden(), warning: 'This saved garden could not be read. A new garden is ready.' };
  } catch {
    return { state: newGarden(), warning: 'Browser storage is unavailable. This garden will last for this visit.' };
  }
}
/** @param {import('./types').Mode} mode @param {import('./types').Garden} state */
export function saveGarden(mode, state) {
  try { localStorage.setItem(storageKey(mode), JSON.stringify(state)); return true; }
  catch { return false; }
}
