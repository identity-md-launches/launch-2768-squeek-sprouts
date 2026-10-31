import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CROPS, PLOT_COSTS, applyWheel, buyPlot, cropById, demoWheel, harvest, newGarden, parseStatus, plant, progress, validGarden } from '../src/engine.js';
import { loadGarden, saveGarden, storageKey } from '../src/storage.js';

const reading = (work, patch = {}) => ({ work: String(work), epoch: 'test-epoch', online: true, running: true, rpm: 128, speed: .42, distance: 1.5, block: '100', receivedAt: 0, expiresAt: Number.MAX_SAFE_INTEGER, ...patch });
const garden = (work = 1000n) => { const state = newGarden(); applyWheel(state, reading(work)); return state; };

test('the economy matches every crop, unlock and plot cost in the brief', () => {
  assert.deepEqual(CROPS.map(c => [c.work, c.cost, c.sell, c.unlock]), [[40,0,6,0],[120,8,20,30],[400,30,70,150],[1000,90,190,500],[3000,260,600,1500]]);
  assert.deepEqual(PLOT_COSTS, [25,60,120,250,500,1000]);
  const s = newGarden(); assert.equal(s.crumbs,10); assert.equal(s.earned,0); assert.equal(s.openPlots,3);
});
test('a new garden cannot plant before its first real measurement', () => { assert.equal(plant(newGarden(), 0).ok, false); });
test('plant, inspect, ripen and harvest use cumulative work, not elapsed time', () => {
  const s = garden(); assert.ok(plant(s,0).ok); assert.equal(s.crumbs,10);
  applyWheel(s, reading(1025)); assert.equal(progress(s,s.plots[0]),25); assert.equal(harvest(s,0,true).ok,false);
  applyWheel(s, reading(1040)); assert.equal(progress(s,s.plots[0]),40); assert.equal(s.journal.filter(e=>e.kind==='ripe').length,1);
  applyWheel(s, reading(1040)); assert.equal(s.journal.filter(e=>e.kind==='ripe').length,1);
  const result=harvest(s,0,false); assert.equal(result.reward,6); assert.equal(s.crumbs,16); assert.equal(s.earned,6); assert.equal(s.plots[0],null);
  assert.equal(harvest(s,0,true).ok,false);
});
test('fresh harvest doubles; golden rolls only when running and multiplies the fresh reward by five', () => {
  for (const [run, roll, reward, gold] of [[false,0,6,false],[true,.15,12,false],[true,.149,60,true],[true,.99,12,false]]) {
    const s=garden(); plant(s,0); applyWheel(s,reading(1040));
    const r=harvest(s,0,run,()=>roll); assert.equal(r.reward,reward); assert.equal(r.golden,gold); assert.equal(s.goldens,gold?1:0);
  }
});
test('stale and expired measurements freeze growth and the last accepted counter', () => {
  const s=garden(); plant(s,0); applyWheel(s,reading(1020));
  applyWheel(s,reading(4000,{online:false})); assert.equal(progress(s,s.plots[0]),20); assert.equal(s.lastWork,'1020');
  applyWheel(s,reading(5000,{expiresAt:1})); assert.equal(progress(s,s.plots[0]),20);
  applyWheel(s,reading(1040)); assert.equal(progress(s,s.plots[0]),40);
});
test('epoch changes preserve progress even when the new counter is higher', () => {
  const s=garden(); plant(s,0); applyWheel(s,reading(1025));
  applyWheel(s,reading(99999,{epoch:'new-epoch'})); assert.equal(progress(s,s.plots[0]),25); assert.equal(s.plots[0].planted,'99974'); assert.equal(s.grown,'25');
  applyWheel(s,reading(100014,{epoch:'new-epoch'})); assert.equal(progress(s,s.plots[0]),40);
});
test('counter rollback rebases all crops, permits negative baselines and preserves ripe crops', () => {
  const s=garden(); plant(s,0); applyWheel(s,reading(1020)); plant(s,1); applyWheel(s,reading(1060));
  applyWheel(s,reading(5)); assert.equal(s.plots[0].planted,'-55'); assert.equal(s.plots[1].planted,'-35');
  assert.equal(progress(s,s.plots[0]),40); assert.equal(progress(s,s.plots[1]),40); assert.equal(validGarden(s),true);
  assert.equal(s.journal.filter(e=>e.kind==='restart').length,1); assert.equal(s.grown,'60');
});
test('counters beyond Number.MAX_SAFE_INTEGER remain exact after save/load and rebase', () => {
  const start=90071992547409930000n,s=garden(start); plant(s,0); applyWheel(s,reading(start+39n));
  assert.equal(progress(s,s.plots[0]),39); const restored=JSON.parse(JSON.stringify(s)); assert.ok(validGarden(restored));
  applyWheel(restored,reading(0,{epoch:'reset'})); assert.equal(restored.plots[0].planted,'-39');
  applyWheel(restored,reading(1,{epoch:'reset'})); assert.equal(progress(restored,restored.plots[0]),40);
});
test('returning after time away catches up from the saved work baseline', () => {
  const s=garden(); plant(s,0); const restored=JSON.parse(JSON.stringify(s));
  applyWheel(restored,reading(1120)); assert.equal(progress(restored,restored.plots[0]),40); assert.equal(restored.grown,'120');
});
test('unlocks use lifetime earnings, not starting balance or current balance', () => {
  const s=garden(); s.selected='carrot'; assert.equal(plant(s,0).ok,false);
  s.selected='radish'; plant(s,0); applyWheel(s,reading(1040)); harvest(s,0,true,()=>0);
  assert.equal(s.earned,60); assert.ok(s.journal.some(e=>e.kind==='unlock'&&e.text.includes('Carrot')));
  s.selected='carrot'; const before=s.crumbs; assert.equal(plant(s,0).ok,true); assert.equal(s.crumbs,before-8);
  s.crumbs=0; assert.equal(plant(s,1).ok,false); s.selected='radish'; assert.equal(plant(s,1).ok,true);
});
test('plots are bought in order at exact prices, without negative balances', () => {
  const s=garden(); assert.equal(buyPlot(s,3).ok,false); assert.equal(buyPlot(s,4).ok,false);
  s.crumbs=2000;s.earned=2000;
  for(let i=3;i<9;i++){const before=s.crumbs; assert.equal(buyPlot(s,i).ok,true); assert.equal(s.crumbs,before-PLOT_COSTS[i-3]);}
  assert.equal(s.openPlots,9);assert.equal(buyPlot(s,9).ok,false);assert.equal(plant(s,9).ok,false);
});
test('all five crops charge correctly, show four growth thresholds and sell for their base prices', () => {
  for(const crop of CROPS){const s=garden(); s.earned=2000; s.crumbs=2000; s.selected=crop.id;
    plant(s,0); assert.equal(s.crumbs,2000-crop.cost);
    for(const ratio of [0,.34,.67,1]){const done=Math.floor(crop.work*ratio); applyWheel(s,reading(1000+done)); assert.equal(progress(s,s.plots[0]),done);}
    assert.equal(harvest(s,0,false).reward,crop.sell);
  }
});
test('demo simulation counts only its run segments, catches up while away and never moves backward', () => {
  const s=newGarden(0); let w=demoWheel(s,15000);applyWheel(s,w,15000);assert.equal(w.work,'60');
  w=demoWheel(s,70000);applyWheel(s,w,70000);assert.equal(w.work,'240');assert.equal(w.running,false);
  w=demoWheel(s,89000);applyWheel(s,w,89000);assert.equal(w.work,'240');
  w=demoWheel(s,100000);applyWheel(s,w,100000);assert.equal(w.work,'280');assert.equal(w.running,true);
  w=demoWheel(s,99999);assert.equal(w.work,'280');
});
test('API parsing converts units and rejects malformed payloads', () => {
  const payload={measurement:{cumulativeWorkUnits:'100',counterEpoch:'one',freshness:'online',coreStatus:'SPINNING',rpmMilli:123456,speedMmPerSecond:420,distanceMm:1500000},builder:{projected:{blockHeight:'333'}}};
  const w=parseStatus(payload,1000);assert.equal(w.rpm,123.456);assert.equal(w.speed,.42);assert.equal(w.distance,1.5);assert.equal(w.running,true);assert.equal(w.block,'333');
  assert.equal(parseStatus({...payload,measurement:{...payload.measurement,freshness:'stale'}}).running,false);
  for(const key of ['cumulativeWorkUnits','rpmMilli','counterEpoch','coreStatus']){const invalid=structuredClone(payload);invalid.measurement[key]=null;assert.throws(()=>parseStatus(invalid));}
  assert.throws(()=>parseStatus({})); assert.throws(()=>parseStatus(null));
});
test('even an online API response is treated as expired when its observation is too old', () => {
  const w=parseStatus({measurement:{cumulativeWorkUnits:'100',counterEpoch:'one',freshness:'online',coreStatus:'SPINNING',rpmMilli:0,speedMmPerSecond:0,distanceMm:0,staleAfterSeconds:120,observedAt:new Date(0).toISOString()},builder:{projected:{blockHeight:'1'}}},200000);
  const s=newGarden();applyWheel(s,w,200000);assert.equal(s.lastWork,null);
});
test('save validation rejects corrupt state and untrusted journal markup stays plain text', () => {
  const s=garden();assert.equal(validGarden(s),true);
  for(const change of [{crumbs:-1},{crumbs:99999},{openPlots:10},{lastWork:'NaN'},{grown:'1.4'},{plots:[]},{selected:'unknown'},{journal:[{at:0,text:'x',kind:'bad'}]},{journal:[{at:Number.MAX_SAFE_INTEGER,text:'invalid date',kind:'note'}]}])assert.equal(validGarden({...s,...change}),false);
  s.journal[0].text='<img src=x onerror=alert(1)>';assert.equal(validGarden(s),true); // Rendering uses textContent, never HTML.
});
test('live and demo save slots are isolated and storage failures are recoverable', () => {
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  const live=garden();plant(live,0);const demo=garden(20);demo.crumbs=8;
  assert.ok(saveGarden('live',live));assert.ok(saveGarden('demo',demo));assert.notEqual(storageKey('live'),storageKey('demo'));
  assert.equal(loadGarden('live').state.plots[0].crop,'radish');assert.equal(loadGarden('demo').state.crumbs,8);
  memory.set(storageKey('live'),'broken JSON');assert.ok(loadGarden('live').warning);assert.equal(loadGarden('live').state.crumbs,10);
  globalThis.localStorage={getItem:()=>{throw Error('blocked')},setItem:()=>{throw Error('quota')}};
  assert.ok(loadGarden('live').warning);assert.equal(saveGarden('live',live),false);delete globalThis.localStorage;
});
