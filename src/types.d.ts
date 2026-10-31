export type CropId = 'radish' | 'carrot' | 'pumpkin' | 'sunflower' | 'melon';
export type Mode = 'live' | 'demo';
export interface Crop { id: CropId; name: string; short: string; work: number; cost: number; sell: number; unlock: number }
export interface Plot { crop: CropId; planted: string; ripeLogged: boolean }
export interface Entry { at: number; text: string; kind: 'note' | 'plant' | 'ripe' | 'harvest' | 'golden' | 'unlock' | 'restart' }
export interface Garden {
  version: 1; crumbs: number; earned: number; openPlots: number;
  plots: (Plot | null)[]; selected: CropId; lastWork: string | null;
  epoch: string | null; grown: string; harvests: number; goldens: number;
  journal: Entry[]; updatedAt: number; demoAt: number;
}
export interface Wheel {
  work: string; epoch: string; online: boolean; running: boolean;
  rpm: number; speed: number; distance: number; block: string;
  receivedAt: number; expiresAt: number;
}
export interface Result { ok: boolean; message: string; reward?: number; golden?: boolean }
